// This is the single file for your Cloudflare Worker, written in ES Module syntax.
// It serves both the HTML page and the client-side JavaScript, OR generates XML directly from query params, OR shows help.

// --- Part 0: Server-Side Helpers ---

// Basic XML escaper (needed for server-side generation).
function escapeXML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"']/g, (match) => {
        switch (match) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return match;
        }
    });
}

// Function to generate XML directly from URLSearchParams
function generateXMLFromServerData(queryParams) {
    const data = {};
    // Extract all relevant parameters into a simple object
    queryParams.forEach((value, key) => {
        // Simple sanitization: trim whitespace and only store if not empty
        const trimmedValue = value.trim();
        if (trimmedValue) { // Exclude empty parameters
            data[key] = trimmedValue;
        }
    });

    // Determine structure based on presence of Windows keys
    // We only create a Windows structure if multi_user or pre_login is explicitly 'true'
    const isWindows = data.multi_user === 'true' || data.pre_login === 'true';
    const windowsKeys = [];
    const dictParts = []; // For the main config(s)

    // --- Generate Windows-specific keys if present ---
    if (isWindows) {
        if (data.multi_user === 'true') { // Only include if explicitly true
            windowsKeys.push(`  <key>multi_user</key>\n  <true/>`);
        }

        if (data.pre_login === 'true') { // Only include if explicitly true
            // Build pre-login dict from prefixed keys (pl_...)
            let plDictString = '';
            // Required for pre-login (Check if they exist)
            if (!data.pl_organization || !data.pl_display_name || !data.pl_service_mode || !data.pl_onboarding || !data.pl_warp_tunnel_protocol || !data.pl_auth_client_id || !data.pl_auth_client_secret) {
                 console.warn("Required pre-login fields missing in query params, pre_login dict might be incomplete.");
            }
             // Add required fields if they exist and are not empty - NOW INDENTED 6 SPACES
            if (data.pl_organization) plDictString += `      <key>organization</key>\n      <string>${escapeXML(data.pl_organization)}</string>\n`; 
            if (data.pl_display_name) plDictString += `      <key>display_name</key>\n      <string>${escapeXML(data.pl_display_name)}</string>\n`; 
            if (data.pl_service_mode) plDictString += `      <key>service_mode</key>\n      <string>${escapeXML(data.pl_service_mode)}</string>\n`; 
             // Add proxy port immediately after service mode if it exists and service mode is proxy
             if (data.pl_service_mode === 'proxy' && data.pl_proxy_port) plDictString += `      <key>proxy_port</key>\n      <integer>${escapeXML(data.pl_proxy_port)}</integer>\n`; 
            if (data.pl_onboarding) plDictString += `      <key>onboarding</key>\n      <${data.pl_onboarding === 'true' ? 'true' : 'false'}/>\n`; 
            if (data.pl_warp_tunnel_protocol) plDictString += `      <key>warp_tunnel_protocol</key>\n      <string>${escapeXML(data.pl_warp_tunnel_protocol)}</string>\n`; 
            if (data.pl_auth_client_id) plDictString += `      <key>auth_client_id</key>\n      <string>${escapeXML(data.pl_auth_client_id)}</string>\n`; 
            if (data.pl_auth_client_secret) plDictString += `      <key>auth_client_secret</key>\n      <string>${escapeXML(data.pl_auth_client_secret)}</string>\n`; 

            // Optional for pre-login - NOW INDENTED 6 SPACES
            if (data.pl_auto_connect) plDictString += `      <key>auto_connect</key>\n      <integer>${escapeXML(data.pl_auto_connect)}</integer>\n`; 
            if (data.pl_support_url) plDictString += `      <key>support_url</key>\n      <string>${escapeXML(data.pl_support_url)}</string>\n`; 
            if (data.pl_unique_client_id) plDictString += `      <key>unique_client_id</key>\n      <string>${escapeXML(data.pl_unique_client_id)}</string>\n`; 
            if (data.pl_enable_post_quantum) plDictString += `      <key>enable_post_quantum</key>\n      <${data.pl_enable_post_quantum === 'true' ? 'true' : 'false'}/>\n`; 
            if (data.pl_switch_locked) plDictString += `      <key>switch_locked</key>\n      <${data.pl_switch_locked === 'true' ? 'true' : 'false'}/>\n`; 
            if (data.pl_allow_updates) plDictString += `      <key>allow_updates</key>\n      <${data.pl_allow_updates === 'true' ? 'true' : 'false'}/>\n`; 
            if (data.pl_override_api_endpoint) plDictString += `      <key>override_api_endpoint</key>\n      <string>${escapeXML(data.pl_override_api_endpoint)}</string>\n`; 
            if (data.pl_override_doh_endpoint) plDictString += `      <key>override_doh_endpoint</key>\n      <string>${escapeXML(data.pl_override_doh_endpoint)}</string>\n`; 
            if (data.pl_override_warp_endpoint) plDictString += `      <key>override_warp_endpoint</key>\n      <string>${escapeXML(data.pl_override_warp_endpoint)}</string>\n`; 

            // Remove trailing newline if exists
            plDictString = plDictString.trimEnd();

            if (plDictString) { // Only add if we actually found pre-login data
                 // Indent the <dict> tags (4 spaces) relative to the key (2 spaces)
                 const plDict = `    <dict>\n${plDictString}\n    </dict>`; 
                 windowsKeys.push(`  <key>pre_login</key>\n${plDict}`); // Key is less indented than dict
            }
        }
    }

    // --- Generate main config dict (assuming only one config via query params for now) ---
    // Check if at least the required fields for a main config exist (without pl_ prefix)
    if (data.organization && data.display_name && data.service_mode && data.onboarding && data.warp_tunnel_protocol) {
        let dictString = '';
        // Required fields
        dictString += `  <key>organization</key>\n  <string>${escapeXML(data.organization)}</string>\n`;
        dictString += `  <key>display_name</key>\n  <string>${escapeXML(data.display_name)}</string>\n`;
        dictString += `  <key>service_mode</key>\n  <string>${escapeXML(data.service_mode)}</string>\n`;
        // Add proxy port immediately after service mode if it exists and service_mode is proxy
        if (data.service_mode === 'proxy' && data.proxy_port) dictString += `  <key>proxy_port</key>\n  <integer>${escapeXML(data.proxy_port)}</integer>\n`;
        dictString += `  <key>onboarding</key>\n  <${data.onboarding === 'true' ? 'true' : 'false'}/>\n`;
        dictString += `  <key>warp_tunnel_protocol</key>\n  <string>${escapeXML(data.warp_tunnel_protocol)}</string>\n`;

        // Optional fields - check if they exist in the data object (meaning they were not empty strings)
        if (data.auth_client_id) dictString += `  <key>auth_client_id</key>\n  <string>${escapeXML(data.auth_client_id)}</string>\n`;
        if (data.auth_client_secret) dictString += `  <key>auth_client_secret</key>\n  <string>${escapeXML(data.auth_client_secret)}</string>\n`;
        if (data.auto_connect) dictString += `  <key>auto_connect</key>\n  <integer>${escapeXML(data.auto_connect)}</integer>\n`;
        if (data.enable_post_quantum) dictString += `  <key>enable_post_quantum</key>\n  <${data.enable_post_quantum === 'true' ? 'true' : 'false'}/>\n`;
        if (data.override_api_endpoint) dictString += `  <key>override_api_endpoint</key>\n  <string>${escapeXML(data.override_api_endpoint)}</string>\n`;
        if (data.override_doh_endpoint) dictString += `  <key>override_doh_endpoint</key>\n  <string>${escapeXML(data.override_doh_endpoint)}</string>\n`;
        if (data.override_warp_endpoint) dictString += `  <key>override_warp_endpoint</key>\n  <string>${escapeXML(data.override_warp_endpoint)}</string>\n`;
        if (data.support_url) dictString += `  <key>support_url</key>\n  <string>${escapeXML(data.support_url)}</string>\n`;
        if (data.switch_locked) dictString += `  <key>switch_locked</key>\n  <${data.switch_locked === 'true' ? 'true' : 'false'}/>\n`;
        if (data.unique_client_id) dictString += `  <key>unique_client_id</key>\n  <string>${escapeXML(data.unique_client_id)}</string>\n`;
        if (data.allow_updates) dictString += `  <key>allow_updates</key>\n  <${data.allow_updates === 'true' ? 'true' : 'false'}/>\n`;
        
        // Remove trailing newline
        dictString = dictString.trimEnd();

        dictParts.push(`<dict>\n${dictString}\n</dict>`);
    } else if (!isWindows) {
        // If not windows and no main config data, return error early
        return '<!-- Error: Required configuration fields (organization, display_name, service_mode, onboarding, warp_tunnel_protocol) not found or empty in query parameters. -->';
    }


    // --- Combine and return final XML string ---
    if (windowsKeys.length === 0) { // Not a windows config
        if (dictParts.length === 0) {
             // This case should be caught above if !isWindows, but as a fallback:
            return '<!-- Error: No valid configuration data found in query parameters. -->';
        } else {
            // Assume only one config dict possible via query params
            return dictParts[0];
        }
    } else { // Is a windows config
        let dictContents = windowsKeys.join('\n');
        
        if (dictParts.length > 0) { // Append the main config if it exists
            // Indent the single dict and wrap in 'configs' key
            const indentedDict = dictParts[0].split('\n').map(line => `    ${line}`).join('\n');
            const instanceXml = `  <key>configs</key>\n${indentedDict}`;
             dictContents += `\n${instanceXml}`;
        } else if (windowsKeys.length === 0) { // Should not happen if isWindows=true but check anyway
             return '<!-- Error: Windows config requested but no valid pre-login or main configuration data found. -->';
        }
        
        return `<dict>\n${dictContents}\n</dict>`;
    }
}

// --- Function to generate Help HTML ---
function generateHelpHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MDM Profile Generator - Query Parameter Help</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; }
        code { background-color: #e2e8f0; padding: 2px 5px; border-radius: 4px; font-family: monospace; }
        li { margin-bottom: 0.5rem; }
        dt { font-weight: 600; margin-top: 0.5rem;}
        dd { margin-left: 1rem; font-size: 0.875rem; color: #4b5563; }
    </style>
</head>
<body class="p-8">
    <div class="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h1 class="text-2xl font-bold text-blue-700 mb-4 border-b pb-2">MDM Profile Generator - Query Parameter Usage</h1>
        
        <p class="mb-4">You can generate an <code>mdm.xml</code> file directly by providing configuration details as URL query parameters and adding <code>?generate=xml</code> to the end of the Worker URL.</p>

        <h2 class="text-xl font-semibold text-gray-800 mt-6 mb-3">Basic Usage (Single Configuration)</h2>
        <p>Provide the required fields and any optional fields directly as parameters. Booleans should be <code>true</code> or <code>false</code>. Empty parameters will be ignored.</p>
        <p class="mt-2"><strong>Example:</strong></p>
        <code class="block p-3 bg-gray-100 rounded text-sm overflow-x-auto">
        /your-worker-url<strong>?generate=xml</strong>&organization=my-org&display_name=My+WARP+Config&service_mode=warp&onboarding=false&warp_tunnel_protocol=masque&auto_connect=1
        </code>

        <h2 class="text-xl font-semibold text-gray-800 mt-6 mb-3">Windows Configuration</h2>
        <p>For Windows-specific settings (<code>multi_user</code>, <code>pre_login</code>), include them directly with a value of <code>true</code>. If <code>pre_login=true</code>, you <strong>must</strong> provide the pre-login configuration details using the <code>pl_</code> prefix.</p>
        <p class="mt-2"><strong>Example (Windows with Pre-login):</strong></p>
        <code class="block p-3 bg-gray-100 rounded text-sm overflow-x-auto">
        /your-worker-url<strong>?generate=xml</strong>&multi_user=true&pre_login=true<strong>&pl_organization=my-org-prelogin</strong>&pl_display_name=PreLogin+Config<strong>&pl_service_mode=warp</strong>&pl_onboarding=false<strong>&pl_warp_tunnel_protocol=masque</strong>&pl_auth_client_id=...&pl_auth_client_secret=...&organization=my-org-user&display_name=User+Config&service_mode=warp&onboarding=false&warp_tunnel_protocol=masque
        </code>
        <p class="text-sm text-gray-600 mt-2">Note: In the Windows example, parameters <em>without</em> the <code>pl_</code> prefix define the configuration used <em>after</em> login (nested under <code>&lt;key&gt;configs&lt;/key&gt;</code> if pre-login is also defined).</p>


        <h2 class="text-xl font-semibold text-gray-800 mt-6 mb-3">Available Parameters</h2>
        <p>The following parameters are recognized. Use the <code>pl_</code> prefix for the pre-login configuration when <code>pre_login=true</code>.</p>
        
        <dl>
            <dt>Required Fields (for any config):</dt>
            <dd><code>organization</code> (string)</dd>
            <dd><code>display_name</code> (string)</dd>
            <dd><code>service_mode</code> (string: warp, 1dot1, proxy, postureonly)</dd>
            <dd><code>onboarding</code> (boolean: true, false)</dd>
            <dd><code>warp_tunnel_protocol</code> (string: masque, wireguard)</dd>
            <dd><code>proxy_port</code> (integer: 1-65535) - <strong>Required only if</strong> <code>service_mode=proxy</code></dd>
            
            <dt>Optional Fields:</dt>
            <dd><code>auth_client_id</code> (string) - Format: 32 lowercase letters/numbers + .access</dd>
            <dd><code>auth_client_secret</code> (string) - Format: 64 letters/numbers</dd>
            <dd><code>unique_client_id</code> (string)</dd>
            <dd><code>enable_post_quantum</code> (boolean: true, false)</dd>
            <dd><code>auto_connect</code> (integer)</dd>
            <dd><code>support_url</code> (string)</dd>
            <dd><code>allow_updates</code> (boolean: true, false)</dd>
            <dd><code>switch_locked</code> (boolean: true, false)</dd>
            <dd><code>override_api_endpoint</code> (string)</dd>
            <dd><code>override_doh_endpoint</code> (string)</dd>
            <dd><code>override_warp_endpoint</code> (string)</dd>

            <dt>Windows-Specific (Root Level):</dt>
            <dd><code>multi_user</code> (boolean: true) - Only include if value is exactly 'true'.</dd>
            <dd><code>pre_login</code> (boolean: true) - Only include if value is exactly 'true'. Requires <code>pl_</code> prefixed parameters.</dd>
        </dl>
         <p class="text-xs text-gray-500 mt-6">Note: Multiple configurations (arrays) are not currently supported via query parameters.</p>
    </div>
</body>
</html>
    `;
}


// --- Part 1: The HTML Page Template ---
// This is *just* the HTML and CSS. The <script> tag now points to /app.js
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare WARP MDM Profile Generator</title>
    <!-- 
      Using Tailwind CDN for simplicity in this single-file setup.
    -->
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /*
          The @import rule for the font must be at the very top of the <style> tag.
        */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc; /* Lighter gray background */
        }

        /* Update pre styles for scrolling */
        pre {
            white-space: pre; /* Prevent wrapping */
            overflow-x: auto; /* Enable horizontal scroll */
        }

        /* Simple animation for new form blocks */
        .fade-in {
            animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* For the sticky sidebar */
        .sticky-sidebar {
            align-self: flex-start; /* Aligns to top */
        }
        
        /* Tooltip Styles */
        .info-icon {
            display: inline-block;
            margin-left: 4px;
            color: #1d4ed8; /* Darker blue text */
            cursor: help;
            position: relative; /* Needed for tooltip positioning */
            font-size: 0.75rem; /* Smaller icon */
            font-weight: bold;
            line-height: 1;
            width: 1rem;
            height: 1rem;
            text-align: center;
            border: 1px solid #93c5fd; /* Medium blue border */
            border-radius: 50%;
            background-color: #dbeafe; /* Light blue background */
        }

        .info-icon::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 100%; /* Position above the icon */
            left: 50%;
            transform: translateX(-50%) translateY(-5px); /* Center and add slight offset */
            background-color: #1f2937; /* Dark gray */
            color: #fff;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 0.75rem; /* Small text */
            white-space: pre-wrap; /* Allow wrapping AND preserve newlines */
            width: max-content; /* Adjust width to content */
            max-width: 250px; /* Max width before wrapping */
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s ease, visibility 0.2s ease;
            z-index: 10;
            pointer-events: none; /* Prevent tooltip from blocking hover */
            text-align: left; /* Ensure text is left-aligned */
            font-weight: normal; /* Normal font weight for tooltip */
        }
        
        .info-icon:hover::after {
            opacity: 1;
            visibility: visible;
        }

        /* Alternating backgrounds for config instances */
        #config-container .config-instance:nth-child(even) {
            background-color: #f9fafb; /* Very light gray for even items */
        }
         #config-container .config-instance:nth-child(odd) {
            background-color: #ffffff; /* White for odd items */
        }

    </style>
</head>
<body class="bg-gray-50 text-gray-900 antialiased">

    <!-- Main container is now wider and uses a flex layout -->
    <div class="container mx-auto max-w-6xl p-4 flex flex-col md:flex-row md:gap-6">

        <!-- Left Column: Form -->
        <div class="md:w-1/2 space-y-4">
            <header class="mb-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <h1 class="text-xl font-bold text-blue-700">Cloudflare WARP MDM Profile Generator</h1>
                <p class="text-sm text-gray-600 mt-1">Create \`mdm.xml\` profiles by filling out the form below. Add multiple configurations for an array output.</p>
                 <p class="text-xs text-gray-500 mt-2">Alternatively, provide configuration via URL query parameters and add <code>?generate=xml</code> to download the file directly. <a href="?help=true" class="text-blue-600 hover:underline">Click here for help</a>.</p>
            </header>
            
            <!-- Main Form -->
            <form id="xml-form" class="space-y-4">
                
                <!-- OS Selector -->
                <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-2">Operating System</h3>
                    <div class="flex items-center gap-x-2">
                        <label for="os_selector" class="text-xs font-medium text-gray-900 whitespace-nowrap">Target OS <span class="text-red-500">*</span></label>
                        <span class="info-icon" id="info-os_selector">i</span> <!-- Added ID for JS targeting -->
                        <select name="os_selector" id="os_selector" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" required>
                            <option value="">(Select an OS)</option>
                            <option value="windows">Windows</option>
                            <option value="macos">MacOS</option>
                            <option value="ios">iOS</option>
                            <option value="android">Android</option>
                            <option value="linux">Linux</option>
                        </select>
                    </div>
                </div>

                <!-- Windows-Specific Settings -->
                <!-- This block is now hidden by default and has an ID -->
                <div id="windows-settings-block" class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hidden">
                    <button type="button" class="toggle-btn flex justify-between items-center w-full mb-3 border-b border-gray-200 pb-2 text-left" data-target="windows-settings-content">
                        <h3 class="text-lg font-semibold text-gray-700">Windows-Specific Settings</h3>
                        <svg class="toggle-icon w-5 h-5 transform transition-transform text-gray-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    
                    <div id="windows-settings-content" class="collapsible-content hidden space-y-4 pt-2">
                        <!-- Changed grid to stack items -->
                        <div class="grid grid-cols-1 gap-y-3">
                            
                            <div class="flex items-center gap-x-2">
                                <label for="multi_user" class="text-xs font-medium text-gray-900 whitespace-nowrap">Multi-User</label>
                                <span class="info-icon" id="info-multi_user">i</span>
                                <select name="multi_user" id="multi_user" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
                                    <option value="">Do not include</option>
                                    <option value="true">True</option>
                                </select>
                            </div>

                            <div class="flex items-center gap-x-2">
                                <label for="pre_login" class="text-xs font-medium text-gray-900 whitespace-nowrap">Pre-login</label>
                                <span class="info-icon" id="info-pre_login">i</span>
                                <select name="pre_login" id="pre_login" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
                                    <option value="">Do not include</option>
                                    <option value="true">True</option>
                                </select>
                            </div>
                        </div>

                        <!-- Pre-login Conditional Fields -->
                        <!-- This div now contains a full configuration block -->
                        <div id="pre-login-options" class="hidden md:col-span-2 pt-3 border-t border-gray-200 mt-4 space-y-3">
                            
                            <!-- Section 1: Required Fields (Always Visible) -->
                            <div>
                                <h4 class="text-sm font-semibold text-gray-800 mb-2">Required Information (for Pre-login)</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="organization_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Organization <span class="text-red-500">*</span></label>
                                        <span class="info-icon" data-field-name="organization">i</span> <!-- Use data attribute for dynamic lookup -->
                                        <input type="text" name="organization_pl" id="organization_pl" class="organization-field w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="cloudflare-security" required disabled>
                                    </div>
                                    
                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="display_name_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Display Name <span class="text-red-500">*</span></label>
                                        <span class="info-icon" data-field-name="display_name">i</span>
                                        <input type="text" name="display_name_pl" id="display_name_pl" class="display-name-field w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="MASQUE Production + PQ" required disabled>
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="service_mode_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Service Mode <span class="text-red-500">*</span></label>
                                        <span class="info-icon" data-field-name="service_mode">i</span>
                                        <select name="service_mode_pl" id="service_mode_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" required disabled>
                                            <option value="">(Select one)</option>
                                                <option value="warp" selected>warp</option>
                                                <option value="1dot1">1dot1</option>
                                                <option value="proxy">proxy</option>
                                                <option value="postureonly">postureonly</option>
                                            </select>
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="onboarding_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Onboarding <span class="text-red-500">*</span></label>
                                        <span class="info-icon" data-field-name="onboarding">i</span>
                                        <select name="onboarding_pl" id="onboarding_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" required disabled>
                                            <option value="">(Select one)</option>
                                            <option value="true">True</option>
                                            <option value="false" selected>False</option>
                                        </select>
                                    </div>

                                    <!-- Moved WARP protocol here -->
                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="warp_tunnel_protocol_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">WARP Protocol <span class="text-red-500">*</span></label>
                                        <span class="info-icon" data-field-name="warp_tunnel_protocol">i</span>
                                        <select name="warp_tunnel_protocol_pl" id="warp_tunnel_protocol_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" required disabled>
                                            <option value="">(Select one)</option>
                                            <option value="masque" selected>masque</option>
                                            <option value="wireguard">wireguard</option>
                                        </select>
                                    </div>
                                    
                                    <!-- Proxy Port (Conditional - Moved to Required) -->
                                    <div class="md:col-span-1 flex items-center gap-x-2 proxy-port-field hidden">
                                        <label for="proxy_port_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Proxy Port <span class="text-red-500">*</span></label>
                                        <span class="info-icon" data-field-name="proxy_port">i</span>
                                        <input type="number" name="proxy_port_pl" id="proxy_port_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="e.g. 8080" min="1" max="65535" step="1" disabled>
                                    </div>

                                    <!-- Moved auth fields here -->
                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="auth_client_id_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Auth Client ID <span class="text-red-500">*</span></label>
                                        <span class="info-icon" data-field-name="auth_client_id">i</span>
                                        <input type="text" name="auth_client_id_pl" id="auth_client_id_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="... .access" disabled pattern="[a-z0-9]{32}\.access" title="Must be 32 lowercase letters/numbers followed by .access">
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="auth_client_secret_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Auth Secret <span class="text-red-500">*</span></label>
                                        <span class="info-icon" data-field-name="auth_client_secret">i</span>
                                        <input type="password" name="auth_client_secret_pl" id="auth_client_secret_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="64-character secret" disabled pattern="[a-zA-Z0-9]{64}" title="Must be exactly 64 letters and numbers.">
                                    </div>
                                </div>
                            </div>

                            <!-- Section 2: Optional Fields (Collapsible) -->
                            <div class="mt-4 pt-3 border-t border-gray-200">
                                <button type="button" class="toggle-btn flex justify-between items-center w-full text-left text-sm font-semibold text-gray-800" data-target="optional-fields_pl">
                                    <span>Optional Fields</span>
                                    <svg class="toggle-icon w-4 h-4 transform transition-transform text-gray-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                                </button>
                                <div id="optional-fields_pl" class="collapsible-content hidden mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="unique_client_id_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Unique Client ID</label>
                                        <span class="info-icon" data-field-name="unique_client_id">i</span>
                                        <input type="text" name="unique_client_id_pl" id="unique_client_id_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="e.g. your-id" disabled>
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="enable_post_quantum_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Post Quantum</label>
                                        <span class="info-icon" data-field-name="enable_post_quantum">i</span>
                                        <select name="enable_post_quantum_pl" id="enable_post_quantum_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" disabled>
                                            <option value="">(Leave empty)</option>
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                        </select>
                                    </div>

                                    <!-- WARP protocol removed from here -->

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="auto_connect_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Auto Connect</label>
                                        <span class="info-icon" data-field-name="auto_connect">i</span>
                                        <input type="number" name="auto_connect_pl" id="auto_connect_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="e.g. 1" disabled>
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="support_url_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Support URL</label>
                                        <span class="info-icon" data-field-name="support_url">i</span>
                                        <input type="text" name="support_url_pl" id="support_url_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="https://support.example.com" disabled>
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="allow_updates_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Allow Updates</label>
                                        <span class="info-icon" data-field-name="allow_updates">i</span>
                                        <select name="allow_updates_pl" id="allow_updates_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" disabled>
                                            <option value="">(Leave empty)</option>
                                            <option value="true">True</option>
                                            <option value="false" selected>False</option>
                                        </select>
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="switch_locked_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">Switch Locked</label>
                                        <span class="info-icon" data-field-name="switch_locked">i</span>
                                        <select name="switch_locked_pl" id="switch_locked_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" disabled>
                                            <option value="">(Leave empty)</option>
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- Section 3: Endpoint Overrides (Collapsible) -->
                            <div class="mt-4 pt-3 border-t border-gray-200">
                                <button type="button" class="toggle-btn flex justify-between items-center w-full text-left text-sm font-semibold text-gray-800" data-target="override-fields_pl">
                                    <span>Endpoint Overrides</span>
                                    <svg class="toggle-icon w-4 h-4 transform transition-transform text-gray-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                                </button>
                                <div id="override-fields_pl" class="collapsible-content hidden mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="override_api_endpoint_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">API Endpoint</LAbel>
                                        <span class="info-icon" data-field-name="override_api_endpoint">i</span>
                                        <input type="text" name="override_api_endpoint_pl" id="override_api_endpoint_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" disabled>
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="override_doh_endpoint_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">DoH Endpoint</LAbel>
                                        <span class="info-icon" data-field-name="override_doh_endpoint">i</span>
                                        <input type="text" name="override_doh_endpoint_pl" id="override_doh_endpoint_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" disabled>
                                    </div>

                                    <div class="md:col-span-1 flex items-center gap-x-2">
                                        <label for="override_warp_endpoint_pl" class="text-xs font-medium text-gray-900 whitespace-nowrap">WARP Endpoint</LAbel>
                                        <span class="info-icon" data-field-name="override_warp_endpoint">i</span>
                                        <input type="text" name="override_warp_endpoint_pl" id="override_warp_endpoint_pl" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" disabled>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- This container will hold all the dynamic config instances -->
                <div id="config-container" class="space-y-4">
                    <!-- A single config instance will be dynamically added here -->
                </div>

                <!-- Action buttons for the form - REMOVED GENERATE BUTTON -->
                <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                    <button type="button" id="add-config-btn" class="w-full sm:w-auto flex-grow justify-center whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                        Add Configuration
                    </button>
                    <!-- Generate button moved to right column -->
                </div>
            </form>
        </div> <!-- End Left Column -->

        <!-- Right Column: Output -->
        <div class="md:w-1/2 md:sticky md:top-4 sticky-sidebar mt-8 md:mt-0 space-y-4"> <!-- Added space-y-4 -->
            <div id="output-section" class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h2 class="text-xl font-semibold text-blue-700 border-b border-gray-200 pb-2 mb-3">Generated \`mdm.xml\`</h2>
                <!-- New helper text paragraph -->
                <p id="os-helper-text" class="text-sm text-gray-700 my-2 font-mono p-3 bg-blue-50 border border-blue-200 rounded-md" style="display: none;"></p>
                
                <!-- This div will show a success message after copying -->
                <div id="copy-success" class="hidden text-sm font-medium text-green-600 mb-3">
                    Copied to clipboard!
                </div>

                <div class="bg-gray-900 rounded-lg shadow-inner overflow-hidden max-h-[70vh]">
                    <div class="bg-gray-800 p-3 text-gray-400 text-xs font-mono flex justify-between items-center">
                        <span>mdm.xml</span>
                    </div>
                    <!-- The 'pre' tag will hold the code and be vertically scrollable -->
                     <pre class="p-4 text-xs text-white overflow-y-auto overflow-x-auto h-full max-h-[calc(70vh-3rem)]"><code id="xml-output" class="language-xml"><!-- XML will appear here after generation --></code></pre> <!-- Added overflow-x-auto -->
                </div>

                 <!-- Buttons moved below XML output -->
                <div class="flex flex-col sm:flex-row gap-3 mt-4">
                     <button type="button" id="generate-btn" class="w-full sm:w-auto flex-grow justify-center whitespace-nowrap rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600">
                        Generate XML
                    </button>
                    <button id="download-btn" class="w-full sm:w-auto flex-grow justify-center whitespace-nowrap rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        Download mdm.xml
                    </button>
                    <button id="copy-btn" class="w-full sm:w-auto flex-grow justify-center whitespace-nowrap rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        Copy to Clipboard
                    </button>
                </div>
            </div>
             <!-- Import Section Moved Here -->
             <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                 <h3 class="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-2">Import Existing Profile</h3>
                 <div class="flex flex-col sm:flex-row gap-3 items-start">
                    <input type="file" id="import-file" accept=".xml" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 flex-grow"/>
                    <button type="button" id="import-btn" class="w-full sm:w-auto justify-center whitespace-nowrap rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">
                        Import XML
                    </button>
                 </div>
                 <p id="import-status" class="text-xs text-red-600 mt-2 h-4"></p> <!-- For error messages -->
            </div>
        </div> <!-- End Right Column -->

    </div> <!-- End Main Container -->

    <!-- 
      This is the HTML template for a single configuration instance.
      It's now split into 3 collapsible sections.
    -->
    <template id="config-template">
        <div class="config-instance p-4 rounded-lg shadow-sm border border-gray-200 fade-in"> <!-- Removed bg-white, will be handled by nth-child -->
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-lg font-semibold text-gray-700">Configuration <span class="instance-number">1</span></h3>
                <button type="button" class="remove-btn rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-200">
                    Remove
                </button>
            </div>

            <!-- Section 1: Required Fields (Always Visible) -->
            <div>
                <h4 class="text-sm font-semibold text-gray-800 mb-2">Required Fields</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="organization__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Organization <span class="text-red-500">*</span></label>
                        <span class="info-icon" data-field-name="organization">i</span>
                        <input type="text" name="organization" id="organization__INDEX__" class="organization-field w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="cloudflare-security" required>
                    </div>
                    
                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="display_name__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Display Name <span class="text-red-500">*</span></label>
                        <span class="info-icon" data-field-name="display_name">i</span>
                        <input type="text" name="display_name" id="display_name__INDEX__" class="display-name-field w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="MASQUE Production + PQ" required>
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="service_mode__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Service Mode <span class="text-red-500">*</span></label>
                        <span class="info-icon" data-field-name="service_mode">i</span>
                        <select name="service_mode" id="service_mode__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" required>
                            <option value="">(Select one)</option>
                                <option value="warp" selected>Gateway with WArp</option>
                                <option value="1dot1">Gateway with DoH</option>
                                <option value="proxy">Proxy Mode</option>
                                <option value="postureonly">Device Info Only</option>
                            </select>
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="onboarding__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Onboarding <span class="text-red-500">*</span></label>
                        <span class="info-icon" data-field-name="onboarding">i</span>
                        <select name="onboarding" id="onboarding__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" required>
                            <option value="">(Select one)</option>
                            <option value="true">True</option>
                            <option value="false" selected>False</option>
                        </select>
                    </div>
                    
                    <!-- Moved WARP protocol here -->
                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="warp_tunnel_protocol__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">WARP Protocol <span class="text-red-500">*</span></label>
                        <span class="info-icon" data-field-name="warp_tunnel_protocol">i</span>
                        <select name="warp_tunnel_protocol" id="warp_tunnel_protocol__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" required>
                            <option value="">(Select one)</option>
                            <option value="masque" selected>masque</option>
                            <option value="wireguard">wireguard</option>
                        </select>
                    </div>

                    <!-- Proxy Port (Conditional - Moved to Required) -->
                    <div class="md:col-span-1 flex items-center gap-x-2 proxy-port-field hidden">
                        <label for="proxy_port__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Proxy Port <span class="text-red-500">*</span></label>
                        <span class="info-icon" data-field-name="proxy_port">i</span>
                        <input type="number" name="proxy_port" id="proxy_port__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="e.g. 8080" min="1" max="65535" step="1">
                    </div>
                </div>
            </div>

            <!-- Section 2: Optional Fields (Collapsible) -->
            <div class="mt-4 pt-3 border-t border-gray-200">
                <button type="button" class="toggle-btn flex justify-between items-center w-full text-left text-sm font-semibold text-gray-800" data-target="optional-fields-__INDEX__">
                    <span>Optional Fields</span>
                    <svg class="toggle-icon w-4 h-4 transform transition-transform text-gray-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </button>
                <div id="optional-fields-__INDEX__" class="collapsible-content hidden mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="auth_client_id__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Auth Client ID</label>
                        <span class="info-icon" data-field-name="auth_client_id">i</span>
                        <input type="text" name="auth_client_id" id="auth_client_id__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="... .access" pattern="[a-z0-9]{32}\.access" title="Must be 32 lowercase letters/numbers followed by .access">
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="auth_client_secret__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Auth Secret</label>
                        <span class="info-icon" data-field-name="auth_client_secret">i</span>
                        <input type="password" name="auth_client_secret" id="auth_client_secret__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="64-character secret" pattern="[a-zA-Z0-9]{64}" title="Must be exactly 64 letters and numbers.">
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="unique_client_id__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Unique Client ID</label>
                        <span class="info-icon" data-field-name="unique_client_id">i</span>
                        <input type="text" name="unique_client_id" id="unique_client_id__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="e.g. your-id">
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="enable_post_quantum__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Post Quantum</label>
                        <span class="info-icon" data-field-name="enable_post_quantum">i</span>
                        <select name="enable_post_quantum" id="enable_post_quantum__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
                            <option value="">(Leave empty)</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                        </select>
                    </div>

                    <!-- WARP protocol removed from here -->

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="auto_connect__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Auto Connect</label>
                        <span class="info-icon" data-field-name="auto_connect">i</span>
                        <input type="number" name="auto_connect" id="auto_connect__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="e.g. 1">
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="support_url__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Support URL</label>
                        <span class="info-icon" data-field-name="support_url">i</span>
                        <input type="text" name="support_url" id="support_url__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="https://support.example.com">
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="allow_updates__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Allow Updates</label>
                        <span class="info-icon" data-field-name="allow_updates">i</span>
                        <select name="allow_updates" id="allow_updates__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
                            <option value="">(Leave empty)</option>
                            <option value="true">True</option>
                            <option value="false" selected>False</option>
                        </select>
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="switch_locked__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">Switch Locked</label>
                        <span class="info-icon" data-field-name="switch_locked">i</span>
                        <select name="switch_locked" id="switch_locked__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
                            <option value="">(Leave empty)</option>
                            <option value="true">True</option>
                            <option value="false">False</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Section 3: Endpoint Overrides (Collapsible) -->
            <div class="mt-4 pt-3 border-t border-gray-200">
                <button type="button" class="toggle-btn flex justify-between items-center w-full text-left text-sm font-semibold text-gray-800" data-target="override-fields-__INDEX__">
                    <span>Endpoint Overrides</span>
                    <svg class="toggle-icon w-4 h-4 transform transition-transform text-gray-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </button>
                <div id="override-fields-__INDEX__" class="collapsible-content hidden mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="override_api_endpoint__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">API Endpoint</LAbel>
                        <span class="info-icon" data-field-name="override_api_endpoint">i</span>
                        <input type="text" name="override_api_endpoint" id="override_api_endpoint__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="override_doh_endpoint__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">DoH Endpoint</LAbel>
                        <span class="info-icon" data-field-name="override_doh_endpoint">i</span>
                        <input type="text" name="override_doh_endpoint" id="override_doh_endpoint__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
                    </div>

                    <div class="md:col-span-1 flex items-center gap-x-2">
                        <label for="override_warp_endpoint__INDEX__" class="text-xs font-medium text-gray-900 whitespace-nowrap">WARP Endpoint</LAbel>
                        <span class="info-icon" data-field-name="override_warp_endpoint">i</span>
                        <input type="text" name="override_warp_endpoint" id="override_warp_endpoint__INDEX__" class="w-full rounded-md border-gray-300 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6">
                    </div>
                </div>
            </div>

        </div>
    </template>

    <!--
      The client-side JavaScript is now loaded from /app.js
      The 'defer' attribute ensures it runs after the HTML is parsed.
    -->
    <script src="/app.js" defer></script>

</body>
</html>
`;

// --- Part 2: The Client-Side JavaScript ---
// This code will be served when the browser requests /app.js
const clientJs = `
// --- Tooltip Content ---
// Edit the text within the backticks (\`) to change the tooltip popups.
// Use \\n for new lines. Avoid complex HTML.
const tooltipContent = {
    os_selector: \`Select the target operating system for the mdm.xml file.\`,
    multi_user: \`Enable support for multiple users on the same device.\`,
    pre_login: \`Connect WARP before the user logs in. *Requires* Auth Client ID/Secret.\`,
    organization: \`Your Cloudflare organization name (e.g., 'mycompany').\`,
    display_name: \`Name shown in the WARP client UI for this configuration.\`,
    service_mode: \`Determines how the client connects (WARP, DoH only, Proxy, Posture).\`,
    onboarding: \`Show the onboarding screens to new users.\`,
    warp_tunnel_protocol: \`Tunnel protocol used by WARP (*masque* or *wireguard*).\`,
    proxy_port: \`Local port for the proxy service (1-65535). Required if Service Mode is 'proxy'.\`,
    auth_client_id: \`Service Auth Client ID from Zero Trust dashboard.\\nFormat: *32 lowercase letters/numbers* followed by *.access*\`,
    auth_client_secret: \`Service Auth Client Secret from Zero Trust dashboard.\\nFormat: *64 letters/numbers*.\`,
    unique_client_id: \`A unique identifier for this client installation. Optional.\`,
    enable_post_quantum: \`Enable post-quantum cryptography support. Optional.\`,
    auto_connect: \`Automatically connect WARP on startup (e.g., *1* for yes). Optional.\`,
    support_url: \`URL displayed in the client for support requests. Optional.\`,
    allow_updates: \`Allow the client to automatically update itself. Default: *False*. Optional.\`,
    switch_locked: \`Prevent users from disabling the WARP connection. Optional.\`,
    override_api_endpoint: \`Override the default Cloudflare API endpoint. Optional.\`,
    override_doh_endpoint: \`Override the default DNS over HTTPS endpoint. Optional.\`,
    override_warp_endpoint: \`Override the default WARP connection endpoint. Optional.\`
};

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('xml-form');
    const configContainer = document.getElementById('config-container');
    const addConfigBtn = document.getElementById('add-config-btn');
    const configTemplate = document.getElementById('config-template');
    
    const outputSection = document.getElementById('output-section');
    const xmlOutput = document.getElementById('xml-output');
    const downloadBtn = document.getElementById('download-btn');
    const copyBtn = document.getElementById('copy-btn');
    const copySuccess = document.getElementById('copy-success');
    const osHelperText = document.getElementById('os-helper-text'); // Find new helper text P tag
    const generateBtn = document.getElementById('generate-btn'); // Find generate button

    // Import elements
    const importFile = document.getElementById('import-file');
    const importBtn = document.getElementById('import-btn');
    const importStatus = document.getElementById('import-status');

    // New OS Selector
    const osSelector = document.getElementById('os_selector');
    const windowsSettingsBlock = document.getElementById('windows-settings-block');

    // New elements for Windows Settings
    const multiUserSelect = document.getElementById('multi_user'); // Give it a specific variable
    const preLoginSelect = document.getElementById('pre_login');
    const preLoginOptions = document.getElementById('pre-login-options');
    
    // Specific fields for pre-login mandatory logic
    const authClientIdPl = document.getElementById('auth_client_id_pl');
    const authClientSecretPl = document.getElementById('auth_client_secret_pl');
    
    // Listen to the static pre-login service_mode dropdown
    const serviceModePl = document.getElementById('service_mode_pl');
    serviceModePl.addEventListener('change', handleServiceModeChange);


    let configIndex = 0;
    let generatedXml = ''; // Store the generated XML globally

    // --- Simple XML/HTML Escaping ---
    
    // Basic XML escaper.
    function escapeXML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[<>&"']/g, (match) => {
            switch (match) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '"': return '&quot;';
                case "'": return '&#39;';
                default: return match;
            }
        });
    }

    // --- Tooltip Setup ---
    function applyTooltips(containerElement) {
        containerElement.querySelectorAll('.info-icon').forEach(icon => {
            const fieldName = icon.dataset.fieldName || icon.id?.replace('info-', ''); // Get field name from data attribute or ID
            if (fieldName && tooltipContent[fieldName]) {
                 // Directly assign the plain text (with escaped newlines)
                 icon.dataset.tooltip = tooltipContent[fieldName]; 
            } else {
                 console.warn("Tooltip content not found for:", fieldName || icon.id); // Add warning for missing tooltips
                 icon.dataset.tooltip = "Info not available."; // Default text
            }
        });
    }

    // Apply tooltips to static elements on load
    applyTooltips(document.body); // Apply to whole body initially


    // --- Helper function for conditional proxy_port field ---
    function handleServiceModeChange(event) {
        const serviceModeSelect = event.target;
        // Find the closest parent container (either the specific pre-login block or a config-instance)
        const parentContainer = serviceModeSelect.closest('#pre-login-options, .config-instance');
        if (!parentContainer) return;

        const proxyPortField = parentContainer.querySelector('.proxy-port-field');
        // Find the proxy port input within that container
        const proxyPortInput = parentContainer.querySelector('[name="proxy_port"], [name="proxy_port_pl"]');
        if (!proxyPortField || !proxyPortInput) return;


        if (proxyPortField) {
            if (serviceModeSelect.value === 'proxy') {
                proxyPortField.classList.remove('hidden');
                proxyPortInput.setAttribute('required', 'true'); // Make required
            } else {
                proxyPortField.classList.add('hidden');
                proxyPortInput.removeAttribute('required'); // Remove required
                // Clear the value when hidden to avoid validation errors
                proxyPortInput.value = ''; 
            }
        }
    }

    // --- OS & Windows Settings Logic ---
    
    osSelector.addEventListener('change', () => {
        const selectedOS = osSelector.value;
        let helperText = '';

        if (selectedOS === 'windows') {
            windowsSettingsBlock.classList.remove('hidden');
            applyTooltips(windowsSettingsBlock); // Apply tooltips when shown
            helperText = "Put this mdm.xml file into the 'C:\\ProgramData\\Cloudflare\\' folder";
        } else {
            windowsSettingsBlock.classList.add('hidden');
            // If we hide the Windows block, reset its values to prevent
            // them from being included in the XML.
            multiUserSelect.value = ''; // Use specific variable
            preLoginSelect.value = ''; 
            // Manually trigger the preLoginSelect's change handler
            // to ensure its child form is also hidden and disabled.
            handlePreLoginChange();

            // Set helper text for other OSes
            if (selectedOS === 'macos') {
                helperText = "Put this mdm.xml file into the '/Library/Application Support/Cloudflare/' folder";
            } else if (selectedOS === 'linux') {
                helperText = "Put this mdm.xml file into the '/var/lib/cloudflare-warp/' folder";
            }
            // No text for ios/android
        }
        
        osHelperText.textContent = helperText;
        osHelperText.style.display = helperText ? 'block' : 'none'; // Show/hide paragraph
    });

    function handlePreLoginChange() {
        const selectedValue = preLoginSelect.value;
        const preLoginInputs = preLoginOptions.querySelectorAll('input, select');

        if (selectedValue === 'true') {
            preLoginOptions.classList.remove('hidden');
            preLoginInputs.forEach(input => input.removeAttribute('disabled'));
            // Set mandatory fields
            authClientIdPl.setAttribute('required', 'true');
            authClientSecretPl.setAttribute('required', 'true');
            // Manually trigger service mode check in case it's already set to 'proxy'
            handleServiceModeChange({ target: serviceModePl });
            // Apply tooltips to newly enabled section
            applyTooltips(preLoginOptions); 
        } else {
            preLoginOptions.classList.add('hidden');
            preLoginInputs.forEach(input => input.setAttribute('disabled', 'true'));
            // Remove mandatory fields
            authClientIdPl.removeAttribute('required');
            authClientSecretPl.removeAttribute('required');
            // Manually trigger service mode check to hide proxy port
            handleServiceModeChange({ target: serviceModePl });
        }
    }

    preLoginSelect.addEventListener('change', handlePreLoginChange);

    // Add toggle listener for the main "Windows-Specific Settings" section
    const windowsToggleBtn = document.querySelector('[data-target="windows-settings-content"]');
    if (windowsToggleBtn) {
        windowsToggleBtn.addEventListener('click', () => {
            const targetContent = document.getElementById('windows-settings-content');
            const icon = windowsToggleBtn.querySelector('.toggle-icon');

            if (targetContent) {
                targetContent.classList.toggle('hidden');
                // Apply tooltips when section is expanded (if not already done)
                if(!targetContent.classList.contains('hidden')) {
                     applyTooltips(targetContent);
                     if (preLoginSelect.value === 'true') {
                          applyTooltips(preLoginOptions);
                     }
                }
            }
            if (icon) {
                icon.classList.toggle('rotate-180');
            }
        });
    }

    // Add toggle listeners for the static pre-login collapsible sections
    preLoginOptions.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const targetContent = document.getElementById(targetId);
            const icon = btn.querySelector('.toggle-icon');

            if (targetContent) {
                targetContent.classList.toggle('hidden');
                 // Apply tooltips when section is expanded
                 if(!targetContent.classList.contains('hidden')) {
                      applyTooltips(targetContent);
                 }
            }
            if (icon) {
                icon.classList.toggle('rotate-180');
            }
        });
    });


    // --- Form Management ---

    // Modified to return the new instance element
    function addConfigInstance(data = null) { 
        configIndex++;
        const templateContent = configTemplate.content.cloneNode(true);
        const newInstance = templateContent.querySelector('.config-instance');
        
        // Update the instance number
        newInstance.querySelector('.instance-number').textContent = configIndex;

        // Make labels, inputs, and toggle targets unique
        newInstance.innerHTML = newInstance.innerHTML.replace(/__INDEX__/g, configIndex);
        
        // Add remove listener
        newInstance.querySelector('.remove-btn').addEventListener('click', () => {
            newInstance.remove();
            updateInstanceNumbers();
        });

        // Add change listener for service_mode
        const serviceModeSelect = newInstance.querySelector('[name="service_mode"]');
        serviceModeSelect.addEventListener('change', handleServiceModeChange);

        // Apply tooltips to the new instance
        applyTooltips(newInstance);

        // Add toggle listeners for collapsible sections
        newInstance.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target; 
                const targetContent = document.getElementById(targetId); // Use getElementById
                const icon = btn.querySelector('.toggle-icon');

                if (targetContent) {
                    targetContent.classList.toggle('hidden');
                    // Apply tooltips when section is expanded
                    if(!targetContent.classList.contains('hidden')) {
                         applyTooltips(targetContent);
                    }
                }
                if (icon) {
                    icon.classList.toggle('rotate-180'); // Rotates chevron
                }
            });
        });

        configContainer.appendChild(newInstance);
        
        // If data is provided (from import), populate the fields
        if(data) {
            populateConfigInstance(newInstance, data);
        }

        updateInstanceNumbers();

        // Manually trigger service mode check after potential population
        handleServiceModeChange({ target: serviceModeSelect });
        
        return newInstance; // Return the created element
    }

    function updateInstanceNumbers() {
        const instances = configContainer.querySelectorAll('.config-instance');
        instances.forEach((instance, index) => {
            instance.querySelector('.instance-number').textContent = index + 1;
            // Hide "Remove" button if it's the last one
            const removeBtn = instance.querySelector('.remove-btn');
            if (removeBtn) {
                 // Always show remove button if there's more than one instance
                 removeBtn.style.display = instances.length > 1 ? 'block' : 'none';
            }
        });
        // Ensure at least one instance exists IF the container is empty AFTER potential removals.
        // This is crucial if the user removes the last block.
        if (configContainer.querySelectorAll('.config-instance').length === 0) {
             // Check if we already added one via import/initial load before adding another
             // This check might be redundant now, but safer.
             // Ensure configIndex reflects the reality after removals.
             configIndex = 0; 
             addConfigInstance();
        }
    }

    // --- XML Generation ---

    function generateXML() {
        // 1. Read Windows settings
        const multiUser = multiUserSelect.value; // Use specific variable
        const preLogin = preLoginSelect.value;
        
        const windowsKeys = [];
        // Only include windows keys if the OS is windows
        if (osSelector.value === 'windows') {
            if (multiUser) { // Check if value is not empty string ("Do not include")
                windowsKeys.push(\`  <key>multi_user</key>\\n  <true/>\`); // Assume only true option exists now
            }
            
            // Handle pre-login config
            if (preLogin === 'true') { // Check if explicitly true
                // Read all pre-login config values by ID
                const org = document.getElementById('organization_pl').value;
                const display = document.getElementById('display_name_pl').value;
                const service = document.getElementById('service_mode_pl').value;
                const onboard = document.getElementById('onboarding_pl').value;
                const authId = document.getElementById('auth_client_id_pl').value;
                const authSec = document.getElementById('auth_client_secret_pl').value;
                const autoConn = document.getElementById('auto_connect_pl').value;
                const support = document.getElementById('support_url_pl').value;
                const uniqueId = document.getElementById('unique_client_id_pl').value;
                const pq = document.getElementById('enable_post_quantum_pl').value;
                const locked = document.getElementById('switch_locked_pl').value;
                const api = document.getElementById('override_api_endpoint_pl').value;
                const doh = document.getElementById('override_doh_endpoint_pl').value;
                const warp = document.getElementById('override_warp_endpoint_pl').value;
                const warpProto = document.getElementById('warp_tunnel_protocol_pl').value;
                const allowUpd = document.getElementById('allow_updates_pl').value;
                const proxyPortPl = document.getElementById('proxy_port_pl').value; 

                // Build the dict string for pre-login config, checking each value - INDENTED 6 SPACES
                let plDictString = '';
                if (org) plDictString += \`      <key>organization</key>\\n      <string>\${escapeXML(org)}</string>\\n\`;
                if (display) plDictString += \`      <key>display_name</key>\\n      <string>\${escapeXML(display)}</string>\\n\`;
                if (service) plDictString += \`      <key>service_mode</key>\\n      <string>\${escapeXML(service)}</string>\\n\`;
                if (service === 'proxy' && proxyPortPl) plDictString += \`      <key>proxy_port</key>\\n      <integer>\${escapeXML(proxyPortPl)}</integer>\\n\`; 
                if (onboard) plDictString += \`      <key>onboarding</key>\\n      <\${onboard}/>\\n\`;
                if (warpProto) plDictString += \`      <key>warp_tunnel_protocol</key>\\n      <string>\${escapeXML(warpProto)}</string>\\n\`; 
                if (authId) plDictString += \`      <key>auth_client_id</key>\\n      <string>\${escapeXML(authId)}</string>\\n\`;
                if (authSec) plDictString += \`      <key>auth_client_secret</key>\\n      <string>\${escapeXML(authSec)}</string>\\n\`;
                if (autoConn) plDictString += \`      <key>auto_connect</key>\\n      <integer>\${escapeXML(autoConn)}</integer>\\n\`;
                if (support) plDictString += \`      <key>support_url</key>\\n      <string>\${escapeXML(support)}</string>\\n\`;
                if (uniqueId) plDictString += \`      <key>unique_client_id</key>\\n      <string>\${escapeXML(uniqueId)}</string>\\n\`;
                if (pq) plDictString += \`      <key>enable_post_quantum</key>\\n      <\${pq}/>\\n\`;
                if (locked) plDictString += \`      <key>switch_locked</key>\\n      <\${locked}/>\\n\`;
                if (allowUpd) plDictString += \`      <key>allow_updates</key>\\n      <\${allowUpd}/>\\n\`;
                if (api) plDictString += \`      <key>override_api_endpoint</key>\\n      <string>\${escapeXML(api)}</string>\\n\`;
                if (doh) plDictString += \`      <key>override_doh_endpoint</key>\\n      <string>\${escapeXML(doh)}</string>\\n\`;
                if (warp) plDictString += \`      <key>override_warp_endpoint</key>\\n      <string>\${escapeXML(warp)}</string>\\n\`;
                
                plDictString = plDictString.trimEnd(); // Remove trailing newline

                if (plDictString) { // Only add if we actually found data
                     // Indent the <dict> tags (4 spaces) relative to the key (2 spaces)
                    const plDict = \`    <dict>\\n\${plDictString}\\n    </dict>\`; 
                    windowsKeys.push(\`  <key>pre_login</key>\\n\${plDict}\`); // Key is less indented than dict
                }
            }
        } // End of Windows-specific key generation
        
        // 2. Process all config instances (post-login)
        const instances = configContainer.querySelectorAll('.config-instance');
        const dictParts = [];

        instances.forEach((instance) => {
            // Read all values from the form, check if they are empty strings
            const organization = instance.querySelector('[name="organization"]').value;
            const displayName = instance.querySelector('[name="display_name"]').value;
            const authClientId = instance.querySelector('[name="auth_client_id"]').value;
            const authClientSecret = instance.querySelector('[name="auth_client_secret"]').value;
            const autoConnect = instance.querySelector('[name="auto_connect"]').value;
            const enablePostQuantum = instance.querySelector('select[name="enable_post_quantum"]').value;
            const onboarding = instance.querySelector('select[name="onboarding"]').value;
            const overrideApi = instance.querySelector('[name="override_api_endpoint"]').value;
            const overrideDoh = instance.querySelector('[name="override_doh_endpoint"]').value;
            const overrideWarp = instance.querySelector('[name="override_warp_endpoint"]').value;
            const serviceMode = instance.querySelector('[name="service_mode"]').value;
            const supportUrl = instance.querySelector('[name="support_url"]').value;
            const switchLocked = instance.querySelector('select[name="switch_locked"]').value;
            const uniqueClientId = instance.querySelector('[name="unique_client_id"]').value;
            const warpProto = instance.querySelector('[name="warp_tunnel_protocol"]').value;
            const allowUpd = instance.querySelector('select[name="allow_updates"]').value;
            const proxyPort = instance.querySelector('[name="proxy_port"]').value; 

            // Start building the key/value pairs, checking each value before adding
            let dictString = '';
            if (organization) dictString += \`  <key>organization</key>\\n  <string>\${escapeXML(organization)}</string>\\n\`;
            if (displayName) dictString += \`  <key>display_name</key>\\n  <string>\${escapeXML(displayName)}</string>\\n\`;
            if (serviceMode) {
                dictString += \`  <key>service_mode</key>\\n  <string>\${escapeXML(serviceMode)}</string>\\n\`;
                if (serviceMode === 'proxy' && proxyPort) { 
                    dictString += \`  <key>proxy_port</key>\\n  <integer>\${escapeXML(proxyPort)}</integer>\\n\`; 
                }
            }
             if (onboarding) dictString += \`  <key>onboarding</key>\\n  <\${onboarding}/>\\n\`;
             if (warpProto) dictString += \`  <key>warp_tunnel_protocol</key>\\n  <string>\${escapeXML(warpProto)}</string>\\n\`;
             if (authClientId) dictString += \`  <key>auth_client_id</key>\\n  <string>\${escapeXML(authClientId)}</string>\\n\`;
             if (authClientSecret) dictString += \`  <key>auth_client_secret</key>\\n  <string>\${escapeXML(authClientSecret)}</string>\\n\`;
             if (autoConnect) dictString += \`  <key>auto_connect</key>\\n  <integer>\${escapeXML(autoConnect)}</integer>\\n\`;
             if (enablePostQuantum) dictString += \`  <key>enable_post_quantum</key>\\n  <\${enablePostQuantum}/>\\n\`;
             if (overrideApi) dictString += \`  <key>override_api_endpoint</key>\\n  <string>\${escapeXML(overrideApi)}</string>\\n\`;
             if (overrideDoh) dictString += \`  <key>override_doh_endpoint</key>\\n  <string>\${escapeXML(overrideDoh)}</string>\\n\`;
             if (overrideWarp) dictString += \`  <key>override_warp_endpoint</key>\\n  <string>\${escapeXML(overrideWarp)}</string>\\n\`;
             if (supportUrl) dictString += \`  <key>support_url</key>\\n  <string>\${escapeXML(supportUrl)}</string>\\n\`;
             if (switchLocked) dictString += \`  <key>switch_locked</key>\\n  <\${switchLocked}/>\\n\`;
             if (uniqueClientId) dictString += \`  <key>unique_client_id</key>\\n  <string>\${escapeXML(uniqueClientId)}</string>\\n\`;
             if (allowUpd) dictString += \`  <key>allow_updates</key>\\n  <\${allowUpd}/>\\n\`;
            
             dictString = dictString.trimEnd(); // Remove trailing newline
             
            // Only push if we added keys (i.e., required fields were present)
            if (dictString) {
                 dictParts.push(\`<dict>\\n\${dictString}\\n</dict>\`);
            }
        });
        
        // 3. Handle final output structure
        if (windowsKeys.length === 0) { // Not a windows config
            if (dictParts.length === 0) {
                return '<!-- No valid configuration instances found. -->';
            } else if (dictParts.length === 1) {
                return dictParts[0]; // Just the single <dict>
            } else {
                // Wrap multiple <dict>s in an <array>
                const indentedDicts = dictParts.map(dict => 
                    dict.split('\\n').map(line => \`  \${line}\`).join('\\n')
                );
                return \`<array>\\n\${indentedDicts.join('\\n')}\\n</array>\`;
            }
        } else { // Is a windows config
            let dictContents = windowsKeys.join('\\n');
            let instanceXml = '';
            // Only add the 'configs' key if there are actual config parts to add
            if(dictParts.length > 0) {
                if (dictParts.length === 1) {
                    const indentedDict = dictParts[0].split('\\n').map(line => \`    \${line}\`).join('\\n');
                    instanceXml = \`  <key>configs</key>\\n\${indentedDict}\`;
                } else { // dictParts.length > 1
                    const indentedDicts = dictParts.map(dict => 
                        dict.split('\\n').map(line => \`      \${line}\`).join('\\n')
                    );
                    const arrayXml = \`    <array>\\n\${indentedDicts.join('\\n')}\\n    </array>\`;
                    instanceXml = \`  <key>configs</key>\\n\${arrayXml}\`;
                }
                dictContents += \`\\n\${instanceXml}\`;
            } 
            // If windowsKeys exist but dictParts is empty, still wrap windowsKeys in <dict>
            return \`<dict>\\n\${dictContents}\\n</dict>\`;
        }
    }

     // --- Import Logic ---
    function parseAndPopulate(xmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "application/xml");
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
             if (parseError) {
                 throw new Error(\`Invalid XML: \${parseError.textContent.trim()}\`);
            }

            // Clear existing dynamic configs BEFORE adding new ones
            configContainer.innerHTML = '';
            configIndex = 0; // Reset index

            const rootElement = xmlDoc.documentElement;
            let configsArray = []; // XML Elements
            let configsData = []; // Parsed data objects
            let isWindowsConfig = false;

            // Reset Windows fields before parsing
            osSelector.value = '';
            multiUserSelect.value = '';
            preLoginSelect.value = '';
            handlePreLoginChange(); // Ensure pre-login form is hidden/disabled

            // Determine the structure
            if (rootElement.tagName === 'dict') {
                const rootData = getDictData(rootElement); // Parse root dict

                // Check specifically for the structure indicating Windows config
                const multiUserKey = Array.from(rootElement.children).find(el => el.tagName === 'key' && el.textContent === 'multi_user');
                const preLoginKey = Array.from(rootElement.children).find(el => el.tagName === 'key' && el.textContent === 'pre_login');
                const configsKey = Array.from(rootElement.children).find(el => el.tagName === 'key' && el.textContent === 'configs');

                if (multiUserKey || preLoginKey || configsKey) { // It's a Windows config structure
                    isWindowsConfig = true;
                    osSelector.value = 'windows';
                    // osSelector.dispatchEvent(new Event('change')); // Trigger OS change handler - now handled later

                    multiUserSelect.value = multiUserKey?.nextElementSibling?.tagName === 'true' ? 'true' : ''; // Only set if true

                    const preLoginDictElement = preLoginKey?.nextElementSibling;
                    if (preLoginDictElement && preLoginDictElement.tagName === 'dict') {
                        preLoginSelect.value = 'true';
                        // handlePreLoginChange(); // Show and enable - happens later
                        populateConfigInstance(preLoginOptions, getDictData(preLoginDictElement)); // Populate static pre-login form
                    } else {
                         preLoginSelect.value = '';
                         // handlePreLoginChange(); // Hide pre-login form - happens later
                    }

                    // Find the 'configs' element (array or dict)
                    const configsElement = configsKey?.nextElementSibling;
                    if (configsElement) {
                        if (configsElement.tagName === 'array') {
                            configsArray = Array.from(configsElement.children).filter(el => el.tagName === 'dict');
                        } else if (configsElement.tagName === 'dict') {
                            configsArray = [configsElement]; // Treat single dict as array of one
                        }
                    }
                    // Extract data from the XML elements
                    configsData = configsArray.map(getDictData);

                } else {
                    // Single dict config (non-windows)
                    configsData = [rootData]; // Use the parsed root data
                    osSelector.value = ''; // Clear OS
                    // osSelector.dispatchEvent(new Event('change')); // Handled later
                }
            } else if (rootElement.tagName === 'array') {
                // Array of dicts (non-windows)
                 configsArray = Array.from(rootElement.children).filter(el => el.tagName === 'dict');
                 configsData = configsArray.map(getDictData); // Extract data
                 osSelector.value = ''; // Clear OS
                 // osSelector.dispatchEvent(new Event('change')); // Handled later
            } else {
                throw new Error("Unsupported root element. Expected <dict> or <array>.");
            }

            // --- Populate Form ---
            
            // Trigger OS change *after* setting its value but *before* adding dynamic blocks
            osSelector.dispatchEvent(new Event('change')); 
            // Trigger pre-login change *after* potentially setting its value
            handlePreLoginChange(); 

            // Populate dynamic config instances using parsed data
            if (configsData.length > 0) {
                configsData.forEach(data => {
                    addConfigInstance(data); // Add and populate
                });
            } else {
                 // If no configs were found in the XML (even for Windows), add one blank one
                 addConfigInstance(); 
            }

            // Ensure tooltips are applied to all elements after potential dynamic changes
            applyTooltips(form); 


            // Trigger generation to update preview AFTER form is fully populated
            // Use setTimeout to ensure DOM updates (like conditional fields) are processed
             setTimeout(() => {
                // Directly call generateXML and update output instead of simulating submit
                generatedXml = generateXML();
                xmlOutput.textContent = generatedXml;
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
             }, 0);

            importStatus.textContent = \`Successfully imported configuration.\`; // Simplified message
            importStatus.className = 'text-xs text-green-600 mt-2 h-4'; // Success styling


        } catch (error) {
            console.error("Import Error:", error);
             importStatus.textContent = \`Import failed: \${error.message}\`;
             importStatus.className = 'text-xs text-red-600 mt-2 h-4'; // Error styling
             // Reset form partially? Or leave as is? Let's leave it.
             // Clear dynamic configs as they might be half-added
             configContainer.innerHTML = '';
             configIndex = 0;
             addConfigInstance(); // Add back a blank one
             // Reset windows fields
             osSelector.value = '';
             osSelector.dispatchEvent(new Event('change'));


        } finally {
            // Clear status after a few seconds
             setTimeout(() => {
                 importStatus.textContent = '';
                 importFile.value = ''; // Clear file input
             }, 5000);
        }
    }

    // Helper to get key-value data from a <dict> element
    function getDictData(dictElement) {
        const data = {};
        const children = Array.from(dictElement.children);
        for (let i = 0; i < children.length; i += 2) {
            const keyElement = children[i];
            const valueElement = children[i + 1];
            if (keyElement?.tagName === 'key' && valueElement) {
                const key = keyElement.textContent.trim();
                let value;
                if (valueElement.tagName === 'string') {
                    value = valueElement.textContent.trim();
                } else if (valueElement.tagName === 'integer') {
                     value = valueElement.textContent.trim(); // Keep as string for form
                } else if (valueElement.tagName === 'true') {
                    value = 'true';
                } else if (valueElement.tagName === 'false') {
                    value = 'false';
                }
                 if(value !== undefined) {
                      data[key] = value;
                 }
            }
        }
        return data;
    }

    // Helper to populate a specific config instance (dynamic or pre-login)
    function populateConfigInstance(instanceElement, data) {
        const isPreLogin = instanceElement.id === 'pre-login-options';
        const suffix = isPreLogin ? '_pl' : '';
        
        // Loop through data and set form values
        for (const key in data) {
             const inputName = \`\${key}\${suffix}\`; // Construct name consistently
             const input = instanceElement.querySelector(\`[name="\${inputName}"]\`);
            
            if (input) {
                 // Handle boolean values represented by <true/> <false/>
                 if (input.tagName === 'SELECT' && (data[key] === 'true' || data[key] === 'false')) {
                     input.value = data[key];
                 } 
                 // Handle integer values (which we stored as strings)
                 else if (input.type === 'number' || key === 'proxy_port') { 
                     input.value = data[key];
                 } 
                 // Handle string values
                 else if (input.tagName === 'INPUT' || input.tagName === 'SELECT') {
                      input.value = data[key];
                 }
                
                 // No need to explicitly trigger change here, it happens after loop in addConfigInstance/parseAndPopulate
            } else {
                 console.warn(\`Input not found for key: \${inputName} during population.\`);
            }
        }
    }

     importBtn.addEventListener('click', () => {
         const file = importFile.files[0];
         if (!file) {
             importStatus.textContent = 'Please select an XML file first.';
             importStatus.className = 'text-xs text-red-600 mt-2 h-4';
             return;
         }

         importStatus.textContent = 'Importing...';
         importStatus.className = 'text-xs text-gray-500 mt-2 h-4';
         importBtn.disabled = true; // Disable button during import


         const reader = new FileReader();
         reader.onload = (e) => {
             const xmlContent = e.target.result;
             parseAndPopulate(xmlContent);
             importBtn.disabled = false; // Re-enable button
         };
         reader.onerror = (e) => {
              console.error("File reading error:", e);
              importStatus.textContent = 'Error reading file.';
              importStatus.className = 'text-xs text-red-600 mt-2 h-4';
              importBtn.disabled = false; // Re-enable button
         };
         reader.readAsText(file);
     });


    // --- Event Listeners ---
    
    // Changed: Listen to click on generate button instead of form submit
    generateBtn.addEventListener('click', () => {
        // Check form validity
         if (!form.checkValidity()) {
            // Find all invalid fields and report them
            const invalidFields = form.querySelectorAll(':invalid');
            invalidFields.forEach(field => {
                // If the field is inside a collapsed section, expand it
                const parentCollapsible = field.closest('.collapsible-content.hidden');
                if (parentCollapsible) {
                    // Check for the main windows section first
                    const windowsContent = field.closest('#windows-settings-content');
                    if(windowsContent && windowsContent.classList.contains('hidden')) {
                         const windowsToggle = document.querySelector('[data-target="windows-settings-content"]');
                         if (windowsToggle) windowsToggle.click();
                    }
                    
                    const toggleBtn = document.querySelector(\`[data-target="\${parentCollapsible.id}"]\`);
                    if (toggleBtn) {
                        toggleBtn.click(); // Programmatically click the toggle
                    }
                }
            });

            // Ask the browser to show the default validation bubbles
            form.reportValidity();
            return; // Stop generation
         }

        // If valid, generate XML
        generatedXml = generateXML();
        
        // Display raw text, not highlighted HTML
        xmlOutput.textContent = generatedXml;
        
        // Enable buttons
        downloadBtn.disabled = false;
        copyBtn.disabled = false;
    });


    addConfigBtn.addEventListener('click', () => addConfigInstance()); // Pass no data for manual add

    downloadBtn.addEventListener('click', () => {
        if (!generatedXml) return;
        const blob = new Blob([generatedXml], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mdm.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    copyBtn.addEventListener('click', () => {
        if (!generatedXml) return;
        
        // Use a temporary textarea to preserve formatting
        const textArea = document.createElement('textarea');
        textArea.value = generatedXml;
        textArea.style.position = 'fixed'; // Avoid scrolling to bottom
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            copySuccess.classList.remove('hidden');
            setTimeout(() => copySuccess.classList.add('hidden'), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
        
        document.body.removeChild(textArea);
    });

    // Add the first instance on page load *after* setting up listeners
    // Ensure initial call happens only if no instances exist (import might have run)
    if (configContainer.children.length === 0) {
        addConfigInstance();
    }
    
    // Manually trigger OS helper text on load & Apply initial tooltips
    osSelector.dispatchEvent(new Event('change'));
    // Apply tooltips again after dynamic elements might be ready
    // Use a small delay to ensure the first instance is fully rendered
    setTimeout(() => {
        applyTooltips(document.body); // Apply to whole body after initial setup
    }, 100); 

});
`;

// --- Part 3: The Worker Fetch Handler ---
// This is the main entry point for the Worker.
// It routes traffic based on path or query parameters.
export default {
    async fetch(request, env, ctx) {
        
        const url = new URL(request.url);

         // --- Handle Help Request ---
        if (url.searchParams.has('help')) {
             const helpHtml = generateHelpHTML();
             return new Response(helpHtml, {
                 headers: { 'Content-Type': 'text/html;charset=UTF-8' },
             });
        }


        // --- Handle Direct XML Generation via Query Params ---
        if (url.searchParams.has('generate') && url.searchParams.get('generate') === 'xml') {
            try {
                const generatedXml = generateXMLFromServerData(url.searchParams);
                 // Check if generation resulted in an error comment
                 if (generatedXml.startsWith('<!-- Error:')) {
                      return new Response(generatedXml, { 
                          status: 400, // Bad Request
                          headers: { 'Content-Type': 'application/xml;charset=utf-8' } 
                      });
                 }
                 // Otherwise, return the valid XML as a download
                return new Response(generatedXml, {
                    headers: { 
                        'Content-Type': 'application/xml;charset=utf-8',
                        'Content-Disposition': 'attachment; filename="mdm.xml"' // Trigger download
                    },
                });
            } catch (error) {
                 console.error("Error generating XML from query params:", error);
                 // Use the escapeXML function defined globally
                 return new Response(`<!-- Error generating XML: ${escapeXML(error.message)} -->`, { 
                     status: 500, // Internal Server Error
                     headers: { 'Content-Type': 'application/xml;charset=utf-8' }
                 });
            }
        }

        // --- Handle Standard Web App Routes ---
        
        // Serve the client-side JavaScript
        if (url.pathname === '/app.js') {
            return new Response(clientJs, {
                headers: { 'Content-Type': 'application/javascript;charset=UTF-8' },
            });
        }

        // Serve the main HTML page for the root path
        if (url.pathname === '/') {
            return new Response(html, {
                headers: { 'Content-Type': 'text/html;charset=UTF-8' },
            });
        }

        // Handle 404s for other paths
        return new Response('Not Found', { status: 404 });
    },
};

