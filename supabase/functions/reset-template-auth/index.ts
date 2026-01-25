import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { templateId } = await req.json();

    if (!templateId) {
      return new Response(
        JSON.stringify({ error: 'templateId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template info
    const { data: template, error: templateError } = await supabaseAdmin
      .from('brand_templates')
      .select('source_profile_id, template_password')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!template.source_profile_id) {
      return new Response(
        JSON.stringify({ error: 'Template does not have a linked profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If password exists, return it directly
    if (template.template_password) {
      const email = `template-${templateId}@virtualmercado.internal`;
      return new Response(
        JSON.stringify({ 
          email,
          password: template.template_password,
          message: 'Credentials retrieved successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new password
    const newPassword = `Template${Date.now()}!${Math.random().toString(36).substring(2, 15)}`;
    const email = `template-${templateId}@virtualmercado.internal`;

    // Update auth user password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      template.source_profile_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating user password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store the new password in the template record
    const { error: storeError } = await supabaseAdmin
      .from('brand_templates')
      .update({ template_password: newPassword })
      .eq('id', templateId);

    if (storeError) {
      console.error('Error storing password:', storeError);
      // Password was updated but not stored - still return it
    }

    return new Response(
      JSON.stringify({ 
        email,
        password: newPassword,
        message: 'Credentials reset successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
