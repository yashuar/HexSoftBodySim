// Simple test script for Mooney-Rivlin switch
console.log('Testing Mooney-Rivlin switch...');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if the switch exists
    const mooneySwitch = document.getElementById('enableMooneyRivlin');
    if (mooneySwitch) {
        console.log('✅ Mooney-Rivlin switch found:', mooneySwitch);
        console.log('Initial state:', mooneySwitch.checked);
        
        // Test toggling
        mooneySwitch.addEventListener('change', (e) => {
            console.log('🔄 Switch changed to:', e.target.checked);
        });
        
        // Visual verification
        const switchWrapper = mooneySwitch.closest('.mui-switch');
        if (switchWrapper) {
            console.log('✅ Switch wrapper found with proper styling');
            const track = switchWrapper.querySelector('.mui-switch-track');
            const thumb = switchWrapper.querySelector('.mui-switch-thumb');
            if (track && thumb) {
                console.log('✅ Switch track and thumb elements found');
            } else {
                console.log('❌ Switch visual elements missing');
            }
        }
    } else {
        console.log('❌ Mooney-Rivlin switch not found');
    }
});
