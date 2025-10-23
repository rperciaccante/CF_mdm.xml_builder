// This is the single file for your Cloudflare Worker.
// It listens for incoming requests and responds with a
// complete HTML page that has all the logic embedded.

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // We only serve the HTML page, regardless of the path.
  // This is a simple "single page app" model.
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

// This template string contains our entire webpage.
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuration Profile Generator</title>
    <!-- 1. We'll use Tailwind CSS for clean, modern styling -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- 2. We'll use Prism.js for nice XML syntax highlighting -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>

    <!-- 3. Use the Inter font family -->
    <style>
      body {
        font-family: 'Inter', sans-serif;
      }
      @import url('https://rsms.me/inter/inter.css');
      
      /* Add a little extra style for the instance blocks */
      .config-instance {
        position: relative;
        border: 1px solid #e5e7eb; /* border-gray-200 */
        border-radius: 0.75rem; /* rounded-xl */
        padding: 1.5rem; /* p-6 */
        margin-top: 1.5rem; /* mt-6 */
      }
      .config-instance:first-child {
        margin-top: 0;
      }
    </style>
</head>
<body class="bg-gray-100 font-sans">

    <div class="container mx-auto p-4 sm:p-8 max-w-3xl">
        <div class="bg-white rounded-2xl shadow-xl p-6 sm:p-10">
            
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Configuration Profile Generator</h1>
            <p class="text-gray-600 mb-6">Fill out the form below to generate a Apple <code>.plist</code> configuration file. Add multiple instances to wrap them in an array.</p>

            <!-- 4. This is the form that asks the questions -->
            <form id="xml-form" class="space-y-4">

                <!-- This container will hold all the dynamic instances -->
                <div id="config-container">
                    <!-- The first instance is added by JavaScript on load -->
                </div>

                <!-- Button to add a new instance -->
                <button type="button" id="add-instance-btn" class="w-full inline-flex justify-center items-center px-6 py-3 border border-dashed border-gray-400 text-sm font-medium rounded-lg text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Another Configuration
                </button>

                <button type="submit" class="mt-6 w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                    Generate XML
                </button>
            </form>
            
            <!-- 5. This section is hidden by default and will show the output -->
            <div id="output-section" class="hidden mt-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">Generated XML</h2>
                
                <!-- This is where the XML is displayed -->
                <pre class="rounded-lg overflow-hidden"><code id="xml-output" class="language-xml"></code></pre>

                <!-- This is the download button -->
                <a id="download-link" 
                   class="mt-4 w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                   download="config.plist">
                   Download config.plist
                </a>
            </div>

        </div>
    </div>

    <!-- 6. This is all the client-side JavaScript logic -->
    <script>
        // Wait for the page to be fully loaded
        document.addEventListener('DOMContentLoaded', () => {
            
            // Get all the elements we need to interact with
            const form = document.getElementById('xml-form');
            const outputSection = document.getElementById('output-section');
            const xmlOutput = document.getElementById('xml-output');
            const downloadLink = document.getElementById('download-link');
            const addInstanceBtn = document.getElementById('add-instance-btn');
            const configContainer = document.getElementById('config-container');

            let instanceCount = 0;

            // --- Helper Functions ---

            // Helper function to escape characters for XML
            function escapeXML(str) {
                if (typeof str !== 'string') return '';
                return str.replace(/[<>&"']/g, (match) => {
                    switch (match) {
                        case '<': return '&lt;';
                        case '>': return '&gt;';
                        case '&': return '&amp;';
                        case '"': return '&quot;';
                        case "'": return '&apos;';
                    }
                });
            }

            // Helper to convert "true"/"false" strings to <true/> or <false/> tags
            const toBooleanTag = (val) => val === 'true' ? '<true/>' : '<false/>';

            // Function to create the HTML for a new config instance
            function createInstanceHTML(instanceId) {
                return \`
                <div class="config-instance" data-id="\${instanceId}">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Configuration Instance \${instanceId}</h3>
                    
                    <button type="button" class="remove-instance-btn absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors" title="Remove Instance">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>

                    <div class="space-y-4">
                        <div>
                            <label for="display_name_\${instanceId}" class="block text-sm font-medium text-gray-700">Display Name <span class="text-red-600">*</span></label>
                            <input type="text" id="display_name_\${instanceId}" class="input-display-name mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="MASQUE Production + PQ" required>
                        </div>

                        <div>
                            <label for="organization_\${instanceId}" class="block text-sm font-medium text-gray-700">Organization <span class="text-red-600">*</span></label>
                            <input type="text" id="organization_\${instanceId}" class="input-organization mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="cloudflare-security" required>
                        </div>
                        
                        <div>
                            <label for="auto_connect_\${instanceId}" class="block text-sm font-medium text-gray-700">Auto Connect (in seconds)</label>
                            <input type="number" id="auto_connect_\${instanceId}" class="input-auto-connect mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="e.g. 10" min="0">
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label for="onboarding_\${instanceId}" class="block text-sm font-medium text-gray-700">Onboarding</label>
                                <select id="onboarding_\${instanceId}" class="input-onboarding mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                    <option value="">Not Set</option>
                                    <option value="false">Disabled</option>
                                    <option value="true">Enabled</option>
                                </select>
                            </div>

                            <div>
                                <label for="allow_updates_\${instanceId}" class="block text-sm font-medium text-gray-700">Allow Updates</label>
                                <select id="allow_updates_\${instanceId}" class="input-allow-updates mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                    <option value="">Not Set</option>
                                    <option value="false">Disabled</option>
                                    <option value="true">Enabled</option>
                                </select>
                            </div>

                            <div>
                                <label for="warp_tunnel_protocol_\${instanceId}" class="block text-sm font-medium text-gray-700">WARP Tunnel Protocol</label>
                                <select id="warp_tunnel_protocol_\${instanceId}" class="input-warp-protocol mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm">
                                    <option value="">Not Set</option>
                                    <option value="masque">Masque</option>
                                    <option value="wireguard">WireGuard</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                \`;
            }

            // Function to add a new instance to the page
            function addNewInstance() {
                instanceCount++;
                const instanceHTML = createInstanceHTML(instanceCount);
                configContainer.insertAdjacentHTML('beforeend', instanceHTML);
            }

            // --- Event Listeners ---

            // Add a new instance when the button is clicked
            addInstanceBtn.addEventListener('click', addNewInstance);

            // Handle removing an instance (using event delegation)
            configContainer.addEventListener('click', (event) => {
                const removeBtn = event.target.closest('.remove-instance-btn');
                if (removeBtn) {
                    // Don't remove the last instance
                    if (configContainer.childElementCount <= 1) {
                        // We can't use alert, so just log to console or add a non-blocking message
                        console.warn('Cannot remove the last configuration instance.');
                        return;
                    }
                    removeBtn.closest('.config-instance').remove();
                }
            });


            // Listen for the form to be submitted
            form.addEventListener('submit', (event) => {
                // Stop the form from submitting in the traditional way
                event.preventDefault();

                // Find all the config instances on the page
                const instances = configContainer.querySelectorAll('.config-instance');
                
                const dictSnippets = [];

                // Loop over each instance and build its <dict> string
                for (const instance of instances) {
                    // Find elements *within* this instance by their class
                    const displayName = instance.querySelector('.input-display-name').value;
                    const organization = instance.querySelector('.input-organization').value;
                    const onboarding = instance.querySelector('.input-onboarding').value;
                    const warpProtocol = instance.querySelector('.input-warp-protocol').value;
                    const allowUpdates = instance.querySelector('.input-allow-updates').value;
                    const autoConnect = instance.querySelector('.input-auto-connect').value;

                    // Build the <dict> snippet for this instance
                    // We'll build an array of XML lines and join them
                    const dictParts = [];
                    
                    // --- Required Fields ---
                    dictParts.push(`    <key>display_name</key>`);
                    dictParts.push(`    <string>${escapeXML(displayName)}</string>`);
                    dictParts.push(`    <key>organization</key>`);
                    dictParts.push(`    <string>${escapeXML(organization)}</string>`);

                    // --- Optional Fields ---

                    // Onboarding (boolean)
                    if (onboarding) { // "true" or "false"
                        dictParts.push(`    <key>onboarding</key>`);
                        dictParts.push(`    ${toBooleanTag(onboarding)}`);
                    }

                    // WARP Protocol (string)
                    if (warpProtocol) { // 'masque' or 'wireguard'
                        dictParts.push(`    <key>warp_tunnel_protocol</key>`);
                        dictParts.push(`    <string>${escapeXML(warpProtocol)}</string>`);
                    }

                    // Allow Updates (boolean)
                    if (allowUpdates) { // "true" or "false"
                        dictParts.push(`    <key>allow_updates</key>`);
                        dictParts.push(`    ${toBooleanTag(allowUpdates)}`);
                    }

                    // Auto Connect (integer)
                    // Check if it's a non-empty string and a valid number
                    if (autoConnect && !isNaN(parseInt(autoConnect, 10))) {
                        dictParts.push(`    <key>auto_connect</key>`);
                        dictParts.push(`    <integer>${escapeXML(autoConnect)}</integer>`);
                    }

                    const dictString = \`
<dict>
${dictParts.join('\n')}
</dict>
                    \`.trim();

                    dictSnippets.push(dictString);
                }

                let xmlBody = '';

                // Check if we need to wrap in an <array>
                if (dictSnippets.length === 0) {
                    // Should not happen, but good to check
                    xmlBody = '<!-- No configuration instances found -->';
                
                } else if (dictSnippets.length === 1) {
                    // Single instance, just use the dict
                    xmlBody = dictSnippets[0];
                
                } else {
                    // Multiple instances, wrap in <array>
                    xmlBody = \`
<array>
    \${dictSnippets.join('\\n    ')}
</array>
                    \`.trim();
                }

                // Build the final XML string
                const xmlString = \`
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
\${xmlBody.replace(/^/gm, '  ')}
</plist>
                \`.trim();

                // 1. Display the XML on the page
                xmlOutput.textContent = xmlString;
                
                // Use Prism.js to highlight the syntax
                Prism.highlightElement(xmlOutput);

                // 2. Create the download file
                const blob = new Blob([xmlString], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                downloadLink.href = url;
                
                const filename = \`config.plist\`;
                downloadLink.download = filename;
                downloadLink.textContent = \`Download \${filename}\`;

                // 3. Show the output section
                outputSection.classList.remove('hidden');

                // 4. Scroll to the output to show the user
                outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            // Add the first instance when the page loads
            addNewInstance();
        });
    </script>
</body>
</html>
`;


