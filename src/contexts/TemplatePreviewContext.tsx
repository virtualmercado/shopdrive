import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

const TEMPLATE_PREVIEW_STORAGE_KEY = "shopdrive_template_preview_active";

const isStoreRoute = (pathname: string) => pathname.startsWith("/loja/");

const hasTemplateEditorContext = (): boolean => {
  try {
    const stored = localStorage.getItem("templateEditorContext");
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return parsed?.mode === "template-editor" && !!parsed?.templateId;
  } catch {
    return false;
  }
};

const readPersistedPreviewFlag = (): boolean => {
  try {
    return sessionStorage.getItem(TEMPLATE_PREVIEW_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const hasPreviewSignalInUrl = (search: string): boolean => {
  const params = new URLSearchParams(search);
  return params.get("templatePreview") === "1" || params.get("mode") === "template-editor";
};

const syncPreviewFlag = (pathname: string, search: string) => {
  if (!isStoreRoute(pathname)) {
    try {
      sessionStorage.removeItem(TEMPLATE_PREVIEW_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    return;
  }

  if (hasPreviewSignalInUrl(search) || hasTemplateEditorContext()) {
    try {
      sessionStorage.setItem(TEMPLATE_PREVIEW_STORAGE_KEY, "1");
    } catch {
      // ignore storage errors
    }
  }
};

const resolveTemplatePreview = (pathname: string, search: string): boolean => {
  if (!isStoreRoute(pathname)) return false;
  if (hasPreviewSignalInUrl(search)) return true;
  if (hasTemplateEditorContext()) return true;
  return readPersistedPreviewFlag();
};

interface TemplatePreviewContextValue {
  isTemplatePreview: boolean;
}

const TemplatePreviewContext = createContext<TemplatePreviewContextValue>({
  isTemplatePreview: false,
});

export const TemplatePreviewProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  const isTemplatePreview = useMemo(
    () => resolveTemplatePreview(location.pathname, location.search),
    [location.pathname, location.search]
  );

  useEffect(() => {
    syncPreviewFlag(location.pathname, location.search);
  }, [location.pathname, location.search]);

  return (
    <TemplatePreviewContext.Provider value={{ isTemplatePreview }}>
      {children}
    </TemplatePreviewContext.Provider>
  );
};

export const useTemplatePreviewSandbox = () => useContext(TemplatePreviewContext);
