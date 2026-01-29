
export class RightClickMenu {
    constructor(workspace) {
        this.workspace = workspace;
        this.menu = null;
        this.activeRange = null;

        this.init();
    }

    init() {
        this.menu = document.createElement('div');
        this.menu.className = 'context-menu';
        this.menu.style.display = 'none';
        document.body.appendChild(this.menu);

        // Global click to close
        document.addEventListener('click', (e) => {
            if (this.menu.style.display === 'block' && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Context Menu Event
        this.workspace.addEventListener('contextmenu', (e) => this.show(e));
    }

    show(e) {
        e.preventDefault();

        // Capture current selection/range
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.activeRange = selection.getRangeAt(0);
        } else {
            // If no selection, try to create one at click
            // Note: caretaker logic is complex, for now we rely on user clicking near text
            if (document.caretRangeFromPoint) {
                this.activeRange = document.caretRangeFromPoint(e.clientX, e.clientY);
            }
        }

        this.renderMenu();

        // Position
        this.menu.style.display = 'block';
        const menuWidth = this.menu.offsetWidth;
        const menuHeight = this.menu.offsetHeight;
        let left = e.pageX;
        let top = e.pageY;

        // Boundary checks
        if (left + menuWidth > window.innerWidth) left -= menuWidth;
        if (top + menuHeight > window.innerHeight) top -= menuHeight;

        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
    }

    hide() {
        this.menu.style.display = 'none';
    }

    renderMenu() {
        this.menu.innerHTML = '';

        const options = [
            {
                label: '🎤 Dictate',
                action: () => {
                    // Trigger dictation toggle from global scope or event
                    // Since manager is in editor.js, we can dispatch event
                    window.dispatchEvent(new CustomEvent('autorica:dictation-toggle'));
                }
            },
            {
                label: '🖼️ Upload Image',
                action: () => this.handleUploadImage()
            },
            {
                label: '✨ Generate Image (AI)',
                action: () => this.handleGenerateImage()
            }
        ];

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.textContent = opt.label;
            item.onclick = () => {
                this.hide();
                opt.action();
            };
            this.menu.appendChild(item);
        });
    }

    handleUploadImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (readerEvent) => {
                    this.insertImage(readerEvent.target.result);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    handleGenerateImage() {
        const prompt = prompt("Enter image description:");
        if (!prompt) return;

        // Use Pollinations.ai (Free, no key)
        const encodedPrompt = encodeURIComponent(prompt);
        // We can add parameters for size, style etc if needed. 
        // Default is usually square. Let's ask for landscape slightly: width=1024&height=768
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;

        // It takes a few seconds to load, so we might want to insert a placeholder or just the image directly
        // Direct insertion might show broken icon briefly.
        this.insertImage(url);
    }

    insertImage(src) {
        if (!this.activeRange) {
            alert('Could not find position to insert image. Please click inside the text.');
            return;
        }

        // Create Image Element
        const img = document.createElement('img');
        img.src = src;
        img.className = 'book-inserted-image';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '4px';
        img.style.margin = '10px 0';
        img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        // Important: resizing control handled by CSS or container

        // Restore selection
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.activeRange);

        // Insert
        this.activeRange.deleteContents();
        this.activeRange.insertNode(img);

        // Move cursor after
        this.activeRange.setStartAfter(img);
        this.activeRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(this.activeRange);

        // Dispatch Input
        const workspace = document.querySelector('.book-workspace');
        if (workspace) workspace.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
