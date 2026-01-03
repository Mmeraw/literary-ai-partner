// Generate SHA-256 hash of VOICE_PRESERVATION_CANON.md
// Used for SOW verification and CI gate implementation

Deno.serve(async (req) => {
    try {
        const canonPath = new URL('./VOICE_PRESERVATION_CANON.md', import.meta.url);
        const canonText = await Deno.readTextFile(canonPath);
        
        // Generate SHA-256 hash
        const encoder = new TextEncoder();
        const data = encoder.encode(canonText);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return Response.json({
            success: true,
            hash: hashHex,
            filename: 'functions/VOICE_PRESERVATION_CANON.md',
            message: 'Add this hash to SOW: "The file functions/VOICE_PRESERVATION_CANON.md, identified by hash ' + hashHex + ', is a binding Canon artifact."'
        });
    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});