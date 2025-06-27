// Debug script to check Mooney-Rivlin switch
console.log('🔍 Debugging Mooney-Rivlin switch...');

// Wait for the application to load
setTimeout(() => {
    console.log('📍 Checking for switch elements...');
    
    // Check if the switch checkbox exists
    const checkbox = document.getElementById('enableMooneyRivlin');
    console.log('Checkbox found:', checkbox);
    
    if (checkbox) {
        console.log('Checkbox type:', checkbox.type);
        console.log('Checkbox checked:', checkbox.checked);
        console.log('Checkbox parent:', checkbox.parentElement);
        
        // Check the switch wrapper
        const switchWrapper = checkbox.closest('.mui-switch');
        console.log('Switch wrapper:', switchWrapper);
        
        if (switchWrapper) {
            console.log('Switch wrapper children:', Array.from(switchWrapper.children));
            
            // Look for track and thumb
            const track = switchWrapper.querySelector('.mui-switch-track');
            const thumb = switchWrapper.querySelector('.mui-switch-thumb');
            console.log('Track element:', track);
            console.log('Thumb element:', thumb);
            
            if (track && thumb) {
                console.log('✅ All switch elements found');
                console.log('Track styles:', {
                    backgroundColor: track.style.backgroundColor,
                    transform: thumb.style.transform
                });
                
                // Test clicking
                console.log('🔄 Testing switch click...');
                switchWrapper.click();
                setTimeout(() => {
                    console.log('After click - Checked:', checkbox.checked);
                    console.log('After click - Track color:', track.style.backgroundColor);
                    console.log('After click - Thumb transform:', thumb.style.transform);
                }, 100);
            } else {
                console.log('❌ Track or thumb element missing');
            }
        } else {
            console.log('❌ Switch wrapper not found');
        }
    } else {
        console.log('❌ Checkbox not found');
        
        // List all elements with IDs to see what's available
        const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
        console.log('Available element IDs:', allIds);
    }
    
    // Check for parameter panel
    const paramPanel = document.getElementById('parameter-panel-mount');
    console.log('Parameter panel mount:', paramPanel);
    if (paramPanel) {
        console.log('Parameter panel children:', Array.from(paramPanel.children));
    }
    
}, 2000); // Wait 2 seconds for the app to fully load
