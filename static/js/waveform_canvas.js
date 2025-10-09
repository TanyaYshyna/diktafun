/**
 * WaveformCanvas - Custom canvas-based audio waveform visualizer
 * Replaces Peaks.js with full interactive functionality
 */
class WaveformCanvas {
    constructor(containerElement, options = {}) {
        // Container and canvas setup
        this.container = containerElement;
        this.canvas = null;
        this.ctx = null;
        
        // Audio properties
        this.audioContext = null;
        this.audioBuffer = null;
        this.audioElement = null;
        this.duration = 0;
        this.currentTime = 0;
        this.isPlaying = false;
        
        // Visual properties
        this.width = 0;
        this.height = 0;
        this.pixelRatio = window.devicePixelRatio || 1;
        
        // Region properties
        this.region = {
            start: 0,
            end: 0,
            isActive: false
        };
        
        // Playhead position
        this.playheadPosition = 0;
        
        // Drag state
        this.dragState = {
            isDragging: false,
            dragType: null, // 'playhead', 'start', 'end', null
            startX: 0,
            startTime: 0
        };
        
        // Configuration
        this.config = {
            // Colors from CSS variables
            waveColor: this.getCSSVariable('--color-button-text-purple') ,
            regionColor: this.getCSSVariable('--color-button-yellow'), // Более видимый оранжевый
            startMarkerColor: this.getCSSVariable('--color-button-text-yellow'),
            endMarkerColor: this.getCSSVariable('--color-button-text-yellow'),
            playheadColor: this.getCSSVariable('--color-button-text-pink'),
            backgroundColor: this.getCSSVariable('--color-button-purple'),
            
            // Marker dimensions
            markerWidth: 8,
            markerHeight: 20,
            playheadWidth: 2,
            
            // Interactive zones
            hitZoneSize: 10
        };
        
        // Event callbacks
        this.callbacks = {
            onRegionUpdate: null,
            onSeek: null,
            onReady: null
        };
        
        // Merge user options
        Object.assign(this.config, options);
        
        this.init();
    }
    
    /**
     * Get CSS variable value
     */
    getCSSVariable(variable) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(variable)
            .trim();
    }
    
    /**
     * Initialize the canvas and setup
     */
    init() {
        if (!this.container) {
            throw new Error('Container element is required');
        }
        
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        
        // Clear container and add canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        
        // Setup resize observer
        this.setupResizeObserver();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initial render
        this.render();
    }
    
    /**
     * Setup resize observer for responsive canvas
     */
    setupResizeObserver() {
        const resizeObserver = new ResizeObserver(() => {
            this.resize();
        });
        resizeObserver.observe(this.container);
    }
    
    /**
     * Resize canvas to fit container
     */
    resize() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        
        // Если размеры контейнера равны 0, устанавливаем минимальные размеры
        if (this.width === 0 || this.height === 0) {
            console.warn('WaveformCanvas: Контейнер имеет нулевые размеры, устанавливаем минимальные');
            this.width = Math.max(this.width, 800);
            this.height = Math.max(this.height, 90);
        }
        
        // Set canvas size considering pixel ratio
        this.canvas.width = this.width * this.pixelRatio;
        this.canvas.height = this.height * this.pixelRatio;
        
        // Scale context for crisp rendering
        this.ctx.scale(this.pixelRatio, this.pixelRatio);
        
        // Update canvas style size
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        
        this.render();
    }
    
    /**
     * Setup mouse event listeners
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('click', this.onClick.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
    
    /**
     * Load audio from URL
     */
    async loadAudio(audioUrl) {
        try {
            console.log('🌊 WaveformCanvas: Loading audio from', audioUrl);
            
            // Create audio context if not exists
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Fetch and decode audio
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.duration = this.audioBuffer.duration;
            console.log('✅ WaveformCanvas: Audio loaded, duration:', this.duration);
            
            // Initialize region to full duration
            this.region.end = this.duration;
            
            // Render waveform
            this.render();
            
            // Trigger ready callback
            if (this.callbacks.onReady) {
                this.callbacks.onReady();
            }
            
        } catch (error) {
            console.error('❌ WaveformCanvas: Error loading audio:', error);
            throw error;
        }
    }
    
    /**
     * Get audio duration
     */
    getDuration() {
        return this.duration;
    }
    
    /**
     * Set region start and end times
     */
    setRegion(start, end) {
        this.region.start = Math.max(0, Math.min(start, this.duration));
        this.region.end = Math.max(this.region.start, Math.min(end, this.duration));
        this.region.isActive = true;
        
        console.log('🎯 WaveformCanvas: Установлен регион', this.region.start, '-', this.region.end, 'isActive:', this.region.isActive);
        
        this.render();
        
        if (this.callbacks.onRegionUpdate) {
            this.callbacks.onRegionUpdate(this.region);
        }
    }
    
    /**
     * Get current region
     */
    getRegion() {
        return { ...this.region };
    }
    
    /**
     * Update region
     */
    updateRegion({ start, end }) {
        if (start !== undefined) this.region.start = Math.max(0, Math.min(start, this.duration));
        if (end !== undefined) this.region.end = Math.max(this.region.start, Math.min(end, this.duration));
        this.render();
        
        if (this.callbacks.onRegionUpdate) {
            this.callbacks.onRegionUpdate(this.region);
        }
    }
    
    /**
     * Set current time (playhead position)
     */
    setCurrentTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        this.playheadPosition = this.currentTime;
        this.render();
    }
    
    /**
     * Get current time
     */
    getCurrentTime() {
        return this.currentTime;
    }
    
    /**
     * Set callback for region updates
     */
    onRegionUpdate(callback) {
        this.callbacks.onRegionUpdate = callback;
    }
    
    /**
     * Set callback for seek events
     */
    onSeek(callback) {
        this.callbacks.onSeek = callback;
    }
    
    /**
     * Set callback for ready event
     */
    onReady(callback) {
        this.callbacks.onReady = callback;
    }
    
    /**
     * Main render method - draws everything
     */
    render() {
        if (!this.ctx || !this.width || !this.height) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw background
        this.drawBackground();
        
        // Draw waveform if audio is loaded
        if (this.audioBuffer) {
            // Сначала рисуем волну
            this.drawWaveform();
            
            // Затем рисуем регион (под волной, чтобы волна была видна)
            if (this.region.isActive) {
                console.log('🎨 WaveformCanvas: Рисуем регион', this.region.start, '-', this.region.end);
                this.drawRegion();
                // Повторно рисуем волну поверх региона (только в области региона)
                this.drawWaveformOverRegion();
            } else {
                console.log('⚠️ WaveformCanvas: Регион неактивен');
            }
            
            // Draw markers
            this.drawMarkers();
            
            // Draw playhead
            this.drawPlayhead();
        }
    }
    
    /**
     * Draw background
     */
    drawBackground() {
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
    
    /**
     * Draw audio waveform
     */
    drawWaveform() {
        if (!this.audioBuffer) return;
        
        const data = this.audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / this.width);
        const amp = this.height / 2;
        
        this.ctx.fillStyle = this.config.waveColor;
        this.ctx.beginPath();
        
        for (let i = 0; i < this.width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            
            const x = i;
            const y = (1 + min) * amp;
            const barHeight = Math.max(1, (max - min) * amp);
            
            this.ctx.fillRect(x, y, 1, barHeight);
        }
    }
    
    /**
     * Draw region overlay
     */
    drawRegion() {
        if (!this.region.isActive || this.duration === 0) {
            console.log('⚠️ drawRegion: Регион неактивен или duration = 0', this.region.isActive, this.duration);
            return;
        }
        
        const startX = (this.region.start / this.duration) * this.width;
        const endX = (this.region.end / this.duration) * this.width;
        const regionWidth = endX - startX;
        
        console.log('🎨 drawRegion: startX =', startX, 'endX =', endX, 'width =', regionWidth, 'canvas width =', this.width);
        
        this.ctx.fillStyle = this.config.regionColor;
        this.ctx.fillRect(startX, 0, regionWidth, this.height);
    }
    
    /**
     * Draw waveform over region (to make wave visible on colored region)
     */
    drawWaveformOverRegion() {
        if (!this.region.isActive || !this.audioBuffer || this.duration === 0) return;
        
        const data = this.audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / this.width);
        const amp = this.height / 2;
        
        const startX = (this.region.start / this.duration) * this.width;
        const endX = (this.region.end / this.duration) * this.width;
        
        this.ctx.fillStyle = this.config.waveColor;
        this.ctx.beginPath();
        
        for (let i = Math.floor(startX); i < Math.ceil(endX); i++) {
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            
            const x = i;
            const y = (1 + min) * amp;
            const barHeight = Math.max(1, (max - min) * amp);
            
            this.ctx.fillRect(x, y, 1, barHeight);
        }
    }
    
    /**
     * Draw start and end markers
     */
    drawMarkers() {
        if (!this.region.isActive || this.duration === 0) return;
        
        const startX = (this.region.start / this.duration) * this.width;
        const endX = (this.region.end / this.duration) * this.width;
        
        // Start marker
        this.drawMarker(startX, this.config.startMarkerColor, 'start');
        
        // End marker
        this.drawMarker(endX, this.config.endMarkerColor, 'end');
    }
    
    /**
     * Draw individual marker
     */
    drawMarker(x, color, type) {
        // Marker line
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();
        
        // Marker handle (top)
        const handleY = 5;
        const handleWidth = this.config.markerWidth;
        const handleHeight = this.config.markerHeight;
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x - handleWidth/2, handleY, handleWidth, handleHeight);
        
        // Add visual indicator for type
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(type === 'start' ? 'S' : 'E', x, handleY + handleHeight/2 + 4);
    }
    
    /**
     * Draw playhead
     */
    drawPlayhead() {
        if (this.duration === 0) return;
        
        const x = (this.playheadPosition / this.duration) * this.width;
        
        // Playhead line
        this.ctx.strokeStyle = this.config.playheadColor;
        this.ctx.lineWidth = this.config.playheadWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();
        
        // Playhead triangle (top)
        const triangleSize = 8;
        this.ctx.fillStyle = this.config.playheadColor;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 5);
        this.ctx.lineTo(x - triangleSize/2, 5 + triangleSize);
        this.ctx.lineTo(x + triangleSize/2, 5 + triangleSize);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    /**
     * Mouse event handlers
     */
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check what was clicked
        const hitTarget = this.getHitTarget(x, y);
        
        if (hitTarget) {
            e.preventDefault();
            this.dragState.isDragging = true;
            this.dragState.dragType = hitTarget.type;
            this.dragState.startX = x;
            this.dragState.startTime = this.timeFromX(x);
            
            this.canvas.style.cursor = 'grabbing';
        }
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (!this.dragState.isDragging) {
            // Update cursor based on what's under mouse
            const hitTarget = this.getHitTarget(x, y);
            if (hitTarget) {
                this.canvas.style.cursor = 'grab';
            } else {
                this.canvas.style.cursor = 'default';
            }
            return;
        }
        
        e.preventDefault();
        
        const newTime = this.timeFromX(x);
        
        switch (this.dragState.dragType) {
            case 'playhead':
                this.setCurrentTime(newTime);
                if (this.callbacks.onSeek) {
                    this.callbacks.onSeek(newTime);
                }
                break;
                
            case 'start':
                this.updateRegion({ start: newTime });
                break;
                
            case 'end':
                this.updateRegion({ end: newTime });
                break;
        }
    }
    
    onMouseUp(e) {
        if (this.dragState.isDragging) {
            this.dragState.isDragging = false;
            this.dragState.dragType = null;
            this.canvas.style.cursor = 'default';
        }
    }
    
    onClick(e) {
        // Only handle clicks if not dragging
        if (this.dragState.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = this.timeFromX(x);
        
        // Seek to clicked position
        this.setCurrentTime(time);
        if (this.callbacks.onSeek) {
            this.callbacks.onSeek(time);
        }
    }
    
    /**
     * Touch event handlers
     */
    onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.onMouseDown(mouseEvent);
    }
    
    onTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.onMouseMove(mouseEvent);
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        this.onMouseUp(mouseEvent);
    }
    
    /**
     * Get hit target at coordinates
     */
    getHitTarget(x, y) {
        if (this.duration === 0) return null;
        
        const halfHitZone = this.config.hitZoneSize / 2;
        
        // Check playhead
        const playheadX = (this.playheadPosition / this.duration) * this.width;
        if (Math.abs(x - playheadX) <= halfHitZone && y <= 30) {
            return { type: 'playhead', x: playheadX };
        }
        
        // Check start marker
        if (this.region.isActive) {
            const startX = (this.region.start / this.duration) * this.width;
            if (Math.abs(x - startX) <= halfHitZone && y <= 30) {
                return { type: 'start', x: startX };
            }
            
            // Check end marker
            const endX = (this.region.end / this.duration) * this.width;
            if (Math.abs(x - endX) <= halfHitZone && y <= 30) {
                return { type: 'end', x: endX };
            }
        }
        
        return null;
    }
    
    /**
     * Convert X coordinate to time
     */
    timeFromX(x) {
        if (this.duration === 0) return 0;
        return Math.max(0, Math.min((x / this.width) * this.duration, this.duration));
    }
    
    /**
     * Convert time to X coordinate
     */
    xFromTime(time) {
        if (this.duration === 0) return 0;
        return (time / this.duration) * this.width;
    }
    
    /**
     * Destroy the waveform and cleanup
     */
    destroy() {
        if (this.audioContext) {
            this.audioContext.close();
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
