import { describe, it, expect } from 'vitest';
import { createUserScopedLoader, classifyProfileLookup } from './authIdentity';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('createUserScopedLoader — troca de conta', () => {
  it('perfil: resposta atrasada da conta A não sobrescreve a conta B', async () => {
    const state: { owner: string | null; slug: string | null } = { owner: null, slug: null };
    const loader = createUserScopedLoader<{ slug: string | null }>((uid, r) => {
      state.owner = uid; state.slug = r.slug;
    });
    const a = deferred<{ slug: string | null }>();
    const b = deferred<{ slug: string | null }>();

    const pa = loader.load('user-A', () => a.promise); // A começa
    const pb = loader.load('user-B', () => b.promise); // troca para B
    b.resolve({ slug: 'loja-da-lulu' });               // B conclui
    await pb;
    a.resolve({ slug: null });                         // A conclui depois (vazia sob RLS)
    await pa;

    expect(state).toEqual({ owner: 'user-B', slug: 'loja-da-lulu' });
  });

  it('funções: funções atrasadas do Master não chegam à sessão do lojista', async () => {
    let roles: string[] = [];
    const loader = createUserScopedLoader<string[]>((_u, r) => { roles = r; });
    const master = deferred<string[]>();
    const lojista = deferred<string[]>();

    const pm = loader.load('master', () => master.promise);
    const pl = loader.load('lojista', () => lojista.promise);
    lojista.resolve([]);
    await pl;
    master.resolve(['admin']);
    await pm;

    expect(roles).toEqual([]);
  });

  it('erro atrasado da conta anterior é descartado', async () => {
    const errors: string[] = [];
    const loader = createUserScopedLoader<number>(() => {}, (uid) => errors.push(uid));
    const a = deferred<number>();
    const pa = loader.load('user-A', () => a.promise);
    loader.invalidate('user-B');
    a.reject(new Error('timeout'));
    await pa;
    expect(errors).toEqual([]);
  });

  it('logout invalida a busca pendente', async () => {
    let applied = false;
    const loader = createUserScopedLoader<number>(() => { applied = true; });
    const a = deferred<number>();
    const pa = loader.load('user-A', () => a.promise);
    loader.invalidate(null);
    a.resolve(1);
    await pa;
    expect(applied).toBe(false);
  });
});

describe('classifyProfileLookup', () => {
  it('erro de consulta nunca vira "sem loja"', () => {
    expect(classifyProfileLookup(null, new Error('network')).resolution).toBe('error');
  });
  it('perfil inexistente = not_found', () => {
    expect(classifyProfileLookup(null, null)).toEqual({ resolution: 'not_found', isMerchant: false });
  });
  it('perfil sem slug = not_found', () => {
    expect(classifyProfileLookup({ store_slug: null }, null).resolution).toBe('not_found');
  });
  it('perfil com slug = found', () => {
    expect(classifyProfileLookup({ store_slug: 'aroma' }, null)).toEqual({ resolution: 'found', isMerchant: true });
  });
});
