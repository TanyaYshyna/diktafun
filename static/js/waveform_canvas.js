/**
 * WaveformCanvas - Пользовательский визуализатор аудио-волн на основе canvas
 * Заменяет Peaks.js с полной интерактивной функциональностью
 */
class WaveformCanvas {
    constructor(containerElement, options = {}) {
        // Настройка контейнера и canvas
        this.container = containerElement;
        this.canvas = null;
        this.ctx = null;

        // Свойства аудио
        this.audioContext = null;
        this.audioBuffer = null;
        this.audioElement = null;
        this.duration = 0;
        this.currentTime = 0;
        this.isPlaying = false;

        // Визуальные свойства
        this.width = 0;
        this.height = 0;
        this.pixelRatio = window.devicePixelRatio || 1;

        // Свойства региона
        this.region = {
            start: 0,
            end: 0
        };

        // Позиция указателя воспроизведения
        this.playheadPosition = 0;

        // Состояние перетаскивания
        this.dragState = {
            isDragging: false,
            dragType: null, // 'playhead', 'start', 'end', null
            startX: 0,
            startTime: 0
        };

        // Конфигурация
        this.config = {
            // Цвета из CSS переменных
            waveColor: this.getCSSVariable('--color-button-text-purple'),
            regionColor: this.getCSSVariable('--color-button-yellow'), // Более видимый оранжевый
            startMarkerColor: this.getCSSVariable('--color-button-text-yellow'),
            endMarkerColor: this.getCSSVariable('--color-button-text-yellow'),
            playheadColor: this.getCSSVariable('--color-button-text-pink'),
            backgroundColor: this.getCSSVariable('--color-button-purple'),

            // Размеры маркеров
            markerWidth: 8,
            markerHeight: 20,
            playheadWidth: 2,

            // Интерактивные зоны
            hitZoneSize: 10
        };

        // Обработчики событий
        this.callbacks = {
            onRegionUpdate: null,
            onSeek: null,
            onReady: null,
            onPlaybackEnd: null
        };

        // Управление аудио
        this.currentAudio = null;
        this.playheadInterval = null;
        this.timeUpdateHandler = null;
        this.pauseHandler = null;
        this.endedHandler = null;

        // Объединяем пользовательские опции
        Object.assign(this.config, options);

        this.init();
    }

    /**
     * Получить значение CSS переменной
     */
    getCSSVariable(variable) {
        return getComputedStyle(document.documentElement)
            .getPropertyValue(variable)
            .trim();
    }

    /**
     * Инициализация canvas и настройка
     */
    init() {
        if (!this.container) {
            throw new Error('Container element is required');
        }

        // Создаем canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';

        // Очищаем контейнер и добавляем canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');

        // Настраиваем наблюдатель изменения размера
        this.setupResizeObserver();

        // Настраиваем обработчики событий
        this.setupEventListeners();

        // Первоначальная отрисовка
        this.render();
    }

    /**
     * Настройка наблюдателя изменения размера для адаптивного canvas
     */
    setupResizeObserver() {
        const resizeObserver = new ResizeObserver(() => {
            this.resize();
        });
        resizeObserver.observe(this.container);
    }

    /**
     * Изменение размера canvas под контейнер
     */
    resize() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        // Если размеры контейнера равны 0, устанавливаем минимальные размеры
        if (this.width === 0 || this.height === 0) {
            // console.warn('WaveformCanvas: Контейнер имеет нулевые размеры, устанавливаем минимальные');
            this.width = Math.max(this.width, 800);
            this.height = Math.max(this.height, 90);
        }

        // Устанавливаем размер canvas с учетом пиксельного соотношения
        this.canvas.width = this.width * this.pixelRatio;
        this.canvas.height = this.height * this.pixelRatio;

        // Масштабируем контекст для четкой отрисовки
        this.ctx.scale(this.pixelRatio, this.pixelRatio);

        // Обновляем размер стиля canvas
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';

        this.render();
    }

    /**
     * Настройка обработчиков событий мыши
     */
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('click', this.onClick.bind(this));

        // События касания для мобильных устройств
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    }

    /**
     * Загрузить аудио из уже существующего Audio элемента
     */
    async loadAudioFromElement(audioElement) {
        try {
            console.log('🌊 WaveformCanvas: Загружаем аудио из существующего элемента');

            // Создаем аудио контекст если не существует
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Получаем URL аудио элемента
            const audioUrl = audioElement.src;

            // Получаем и декодируем аудио
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            const rawDurationEl = this.audioBuffer.duration || 0;
            this.duration = Math.floor(rawDurationEl * 100) / 100; // отсечение до сотых
            console.log('✅ WaveformCanvas: Аудио загружено из элемента, длительность:', this.duration);

            // Инициализируем регион на всю длительность
            this.region.end = this.duration;

            // Сбрасываем playhead в начало региона при загрузке нового источника
            if (typeof this.setCurrentTime === 'function') {
                this.setCurrentTime(this.region.start || 0);
            }

            // Отрисовываем волну
            this.render();

            // Вызываем callback готовности
            if (this.callbacks.onReady) {
                this.callbacks.onReady();
            }

        } catch (error) {
            console.error('❌ WaveformCanvas: Ошибка загрузки аудио из элемента:', error);
            throw error;
        }
    }
    async loadAudio(audioUrl) {
        try {
            console.log('🌊 WaveformCanvas: Loading audio from', audioUrl);

            // Создаем аудио контекст если не существует
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Получаем и декодируем аудио
            const response = await fetch(audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            const rawDuration = this.audioBuffer.duration || 0;
            this.duration = Math.floor(rawDuration * 100) / 100; // отсечение до сотых
            console.log('✅ WaveformCanvas: Audio loaded, duration:', this.duration);

            // Инициализируем регион на всю длительность
            this.region.end = this.duration;

            // Сбрасываем playhead в начало региона при загрузке нового источника
            if (typeof this.setCurrentTime === 'function') {
                this.setCurrentTime(this.region.start || 0);
            }

            // Отрисовываем волну
            this.render();

            // Вызываем callback готовности
            if (this.callbacks.onReady) {
                this.callbacks.onReady();
            }

        } catch (error) {
            console.error('❌ WaveformCanvas: Error loading audio:', error);
            throw error;
        }
    }

    /**
     * Получить длительность аудио
     */
    getDuration() {
        return this.duration;
    }

    /**
     * Установить время начала и конца региона
     */
    setRegion(start, end) {
        // console.log('🎯 WaveformCanvas: setRegion вызван с параметрами:', start, '-', end);
        // console.trace('🎯 WaveformCanvas: Стек вызовов setRegion:');

        this.region.start = Math.max(0, Math.min(start, this.duration));
        this.region.end = Math.max(this.region.start, Math.min(end, this.duration));

        // console.log('🎯 WaveformCanvas: Установлен регион', this.region.start, '-', this.region.end);

        this.render();

        if (this.callbacks.onRegionUpdate) {
            this.callbacks.onRegionUpdate(this.region);
        }
    }

    /**
     * Получить текущий регион
     */
    getRegion() {
        return { ...this.region };
    }

    /**
     * Обновить регион
     */
    updateRegion({ start, end }) {
        if (start !== undefined) this.region.start = Math.max(0, Math.min(start, this.duration));
        if (end !== undefined) this.region.end = Math.max(this.region.start, Math.min(end, this.duration));
        console.log('🔧 WaveformCanvas: updateRegion вызван, новый регион:', this.region.start.toFixed(2), '-', this.region.end.toFixed(2));
        this.render();

        if (this.callbacks.onRegionUpdate) {
            console.log('🔧 WaveformCanvas: Вызываем callback onRegionUpdate');
            this.callbacks.onRegionUpdate(this.region);
        } else {
            console.warn('⚠️ WaveformCanvas: Callback onRegionUpdate не установлен!');
        }
    }

    /**
     * Установить текущее время (позиция указателя воспроизведения)
     */
    setCurrentTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        this.playheadPosition = this.currentTime;
        // console.log('🎯 WaveformCanvas: setCurrentTime установлено:', this.currentTime);

        // Синхронизируем позицию аудио с красной полоской только если аудио НЕ играет
        if (this.currentAudio && this.currentAudio.paused) {
            this.currentAudio.currentTime = this.currentTime;
            // console.log('🎯 WaveformCanvas: Синхронизирована позиция аудио с красной полоской:', this.currentTime);
        }

        this.render();
    }

    /**
     * Обновить позицию указателя воспроизведения из внешнего аудио элемента
     */
    updatePlayheadFromAudio(audioElement) {
        if (audioElement && this.duration > 0) {
            const currentTime = audioElement.currentTime || 0;
            this.playheadPosition = currentTime;
            this.currentTime = currentTime; // Синхронизируем currentTime тоже!
            this.render();
        }
    }

    /**
     * Получить текущее время
     */
    getCurrentTime() {
        return this.currentTime;
    }

    /**
     * Установить callback для обновлений региона
     */
    onRegionUpdate(callback) {
        this.callbacks.onRegionUpdate = callback;
    }

    /**
     * Установить callback для событий поиска
     */
    onSeek(callback) {
        this.callbacks.onSeek = callback;
    }

    /**
     * Установить callback для события готовности
     */
    onReady(callback) {
        this.callbacks.onReady = callback;
    }

    /**
     * Установить callback для события окончания воспроизведения
     */
    onPlaybackEnd(callback) {
        this.callbacks.onPlaybackEnd = callback;
    }

    /**
     * Запустить воспроизведение аудио с учетом региона
     */
    async startPlayback(audioElement) {
        console.log('🎯 WaveformCanvas: Запуск воспроизведения');
        if (!audioElement) {
            console.warn('WaveformCanvas: audioElement is null in startPlayback');
            return;
        }

        // Проверяем, что аудио загружено
        if (!audioElement.src) {
            console.warn('WaveformCanvas: audioElement.src is empty');
            return;
        }

        // Ждем загрузки аудио если нужно
        if (audioElement.readyState < 2) { // HAVE_CURRENT_DATA
            console.log('🎯 WaveformCanvas: Ждем загрузки аудио...');
            await new Promise((resolve, reject) => {
                audioElement.onloadeddata = resolve;
                audioElement.onerror = reject;
                // Таймаут на случай если загрузка зависнет
                setTimeout(() => reject(new Error('Timeout loading audio')), 5000);
            });
        }

        // Если регион невалидный / не установлен – растягиваем до всей длительности
        console.log('🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯 WaveformCanvas: Регион:', this.region);
        if (!this.region || this.region.end <= this.region.start) {
            if (this.region.end < this.region.start) {
                console.log('🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯 WaveformCanvas: Регион не установлен МЕНЯЕМ МЕСТАМИ');
                const st = this.region.start;
                this.region.start = this.region.end;
                this.region.end = st
            } else if (this.region.end = this.region.start) {
                console.log('🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯 WaveformCanvas: Регион не установлен ИГРАЕМ ВСЕ АУДИО');
                this.region.start = 0;
                this.region.end = this.duration || audioElement.duration || 0;
            }
        }

        // Определяем время начала воспроизведения
        let startTime = this.currentTime;
        console.log('🎯🎯🎯 WaveformCanvas: Playhead за границами региона, перепрыгиваем на:', startTime);

        // Если playhead за границами региона - перепрыгиваем на начало региона
        if (this.currentTime < this.region.start || this.currentTime > this.region.end) {
            startTime = this.region.start;
            this.setCurrentTime(startTime);
            console.log('🎯🎯🎯🎯🎯 WaveformCanvas: Playhead за границами региона, перепрыгиваем на:', startTime);
        }

        // Устанавливаем время начала для аудио
        audioElement.currentTime = Math.max(0, startTime || 0);

        // Начинаем контроль воспроизведения
        this.startAudioControl(audioElement);

        // Запускаем воспроизведение
        try {
            console.log('🎯 WaveformCanvas: Запускаем воспроизведение с позиции:', startTime);
            console.log('🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯 WaveformCanvas: Регион:', this.region);
            console.log('🎯 WaveformCanvas: audioElement.duration:', audioElement.duration);
            await audioElement.play();
            console.log('🎯 WaveformCanvas: Воспроизведение запущено успешно!');
        } catch (error) {
            console.error('❌ WaveformCanvas: Ошибка запуска воспроизведения:', error);
            throw error;
        }
    }

    /**
     * Очистить только интервал обновления (без остановки аудио)
     */
    clearPlayheadInterval() {
        if (this.playheadInterval) {
            clearInterval(this.playheadInterval);
            this.playheadInterval = null;
        }
    }


    startAudioControl(audioElement) {
        console.log('🎯 WaveformCanvas: startAudioControl вызван');
        this.currentAudio = audioElement;
        this.isPlaying = true;

        // Уведомляем глобальный аудио менеджер о текущем плеере
        if (window.AudioManager) {
            console.log('🎯 WaveformCanvas: Уведомляем AudioManager');
            window.AudioManager.setCurrent(audioElement);
        }

        // Очищаем предыдущие обработчики
        // this.stopAudioControl();

        // Обновление playhead через rAF для более плавной анимации
        const tick = () => {
            if (!this.isPlaying || !this.currentAudio) return;
            this.updatePlayheadFromAudio(audioElement);
            this.playheadInterval = requestAnimationFrame(tick);
        };
        this.playheadInterval = requestAnimationFrame(tick);

        // Добавляем обработчик timeupdate для более точного контроля
        const EPS = 0.0005; // небольшой допуск на сравнение времени
        this.timeUpdateHandler = () => {
            if (audioElement.currentTime + EPS >= this.region.end) {
                console.log('🎯 WaveformCanvas timeupdate: Достигнут конец региона, останавливаем воспроизведение');
                console.log('🎯 WaveformCanvas: Вызываем audioElement.pause()');
                audioElement.pause();
                audioElement.currentTime = this.region.start; // Аудио прыгает в начало региона
                this.setCurrentTime(this.region.start); // Возвращаем playhead в начало региона
                this.isPlaying = false;

                // Вызываем callback окончания воспроизведения
                if (this.callbacks.onPlaybackEnd) {
                    console.log('🎯 WaveformCanvas: Вызываем callback onPlaybackEnd');
                    this.callbacks.onPlaybackEnd();
                }

                // // Удаляем обработчик
                // audioElement.removeEventListener('timeupdate', this.timeUpdateHandler);
            }
        };
        audioElement.addEventListener('timeupdate', this.timeUpdateHandler);

        // Добавляем обработчик для события pause (когда аудио останавливается извне)
        this.pauseHandler = () => {
            console.log('🎯 WaveformCanvas: Аудио приостановлено извне');
            this.isPlaying = false;
            this.stopAudioControl();
        };
        audioElement.addEventListener('pause', this.pauseHandler);

        // Добавляем обработчик для события ended (когда аудио заканчивается естественным образом)
        this.endedHandler = () => {
            console.log('🎯 WaveformCanvas: Аудио закончилось естественным образом');
            this.isPlaying = false;
            this.stopAudioControl();

            // НЕ вызываем callback onPlaybackEnd - это делает плеер в playAudioFile
            // Плеер сам управляет состоянием кнопки через свой onended
        };
        audioElement.addEventListener('ended', this.endedHandler);
    }

    /**
     * Остановить управление воспроизведением аудио
     */
    stopAudioControl() {
        // console.log('🎯 WaveformCanvas: stopAudioControl вызван');

        // Сохраняем текущую позицию аудио перед остановкой
        let currentAudioTime = 0;
        if (this.currentAudio) {
            currentAudioTime = this.currentAudio.currentTime;
            this.currentAudio.pause();
            // console.log('🎯 WaveformCanvas: Аудио остановлено на позиции:', currentAudioTime);
        }

        // Обновляем позицию playhead на текущую позицию аудио
        this.playheadPosition = currentAudioTime;
        this.currentTime = currentAudioTime;

        // Перерисовываем для отображения актуальной позиции
        this.render();

        // Останавливаем аудио
        // if (this.currentAudio) {
        //     this.currentAudio.pause();
        //     console.log('🎯 WaveformCanvas: Аудио остановлено');
        // }

        // Очищаем обновление playhead
        if (this.playheadInterval) {
            if (typeof cancelAnimationFrame !== 'undefined') {
                cancelAnimationFrame(this.playheadInterval);
            } else {
                clearInterval(this.playheadInterval);
            }
            this.playheadInterval = null;
            // console.log('🎯 WaveformCanvas: playhead update loop очищен');
        }

        // Удаляем обработчики событий
        if (this.currentAudio) {
            if (this.timeUpdateHandler) {
                this.currentAudio.removeEventListener('timeupdate', this.timeUpdateHandler);
                this.timeUpdateHandler = null;
                // console.log('🎯 WaveformCanvas: timeUpdateHandler удален');
            }
            if (this.pauseHandler) {
                this.currentAudio.removeEventListener('pause', this.pauseHandler);
                this.pauseHandler = null;
                // console.log('🎯 WaveformCanvas: pauseHandler удален');
            }
            if (this.endedHandler) {
                this.currentAudio.removeEventListener('ended', this.endedHandler);
                this.endedHandler = null;
                // console.log('🎯 WaveformCanvas: endedHandler удален');
            }
        }

        this.currentAudio = null;
        this.isPlaying = false;
        // console.log('🎯 WaveformCanvas: stopAudioControl завершен');
    }

    /**
     * Обновить позицию аудио при клике по волне
     */
    updateAudioPosition(time) {
        if (this.currentAudio) {
            // Проверяем, не выходим ли мы за границы региона
            if (time < this.region.start) {
                time = this.region.start;
                // console.log('🎯 WaveformCanvas: Клик за началом региона, перепрыгиваем на начало');
            } else if (time > this.region.end) {
                time = this.region.end;
                // console.log('🎯 WaveformCanvas: Клик за концом региона, перепрыгиваем на конец');
            }

            this.currentAudio.currentTime = time;
            // console.log('🎯 WaveformCanvas: Обновлена позиция аудио на:', time);
        }
    }

    /**
     * Основной метод отрисовки - рисует все
     */
    render() {
        if (!this.ctx || !this.width || !this.height) return;

        // Очищаем canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Рисуем фон
        this.drawBackground();

        // Рисуем волну если аудио загружено
        if (this.audioBuffer) {
            // Сначала рисуем волну
            this.drawWaveform();

            this.drawRegion();
            this.drawWaveformOverRegion();

            // Draw markers
            this.drawMarkers();

            // Draw playhead
            this.drawPlayhead();
        }
    }

    /**
     * Рисование фона
     */
    drawBackground() {
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * Рисование аудио волны
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
     * Рисование наложения региона
     */
    drawRegion() {
        if (this.duration === 0) {
            return;
        }

        const startX = (this.region.start / this.duration) * this.width;
        const endX = (this.region.end / this.duration) * this.width;
        const regionWidth = endX - startX;

        this.ctx.fillStyle = this.config.regionColor;
        this.ctx.fillRect(startX, 0, regionWidth, this.height);
    }

    /**
     * Рисование волны поверх региона (чтобы волна была видна на цветном регионе)
     */
    drawWaveformOverRegion() {
        if (!this.audioBuffer || this.duration === 0) return;

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
     * Рисование маркеров начала и конца
     */
    drawMarkers() {
        if (this.duration === 0) return;

        const startX = (this.region.start / this.duration) * this.width;
        const endX = (this.region.end / this.duration) * this.width;

        // Маркер начала
        this.drawMarker(startX, this.config.startMarkerColor, 'start');

        // Маркер конца
        this.drawMarker(endX, this.config.endMarkerColor, 'end');
    }

    /**
     * Рисование отдельного маркера
     */
    drawMarker(x, color, type) {
        // Линия маркера
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();

        // Ручка маркера (сверху)
        const handleY = 5;
        const handleWidth = this.config.markerWidth;
        const handleHeight = this.config.markerHeight;

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x - handleWidth / 2, handleY, handleWidth, handleHeight);

        // Добавляем визуальный индикатор типа
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(type === 'start' ? 'S' : 'E', x, handleY + handleHeight / 2 + 4);
    }

    /**
     * Рисование указателя воспроизведения
     */
    drawPlayhead() {
        if (this.duration === 0) return;

        const x = (this.playheadPosition / this.duration) * this.width;

        // Линия указателя воспроизведения
        this.ctx.strokeStyle = this.config.playheadColor;
        this.ctx.lineWidth = this.config.playheadWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();

        // Треугольник указателя воспроизведения (сверху)
        const triangleSize = 8;
        this.ctx.fillStyle = this.config.playheadColor;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 5);
        this.ctx.lineTo(x - triangleSize / 2, 5 + triangleSize);
        this.ctx.lineTo(x + triangleSize / 2, 5 + triangleSize);
        this.ctx.closePath();
        this.ctx.fill();
    }

    /**
    * Обновление позиции курсора на основе текущего времени аудио
    */
    updatePlayheadFromAudio(audioElement) {
        if (!audioElement || !this.audioBuffer) return;

        // Обновляем логическое время и позицию (в секундах), а не пиксели
        const currentTime = audioElement.currentTime || 0;
        this.currentTime = currentTime;
        this.playheadPosition = currentTime;

        // Перерисовываем волну с новым положением курсора
        this.render();
    }


    /**
     * Обработчики событий мыши
     */
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Проверяем что было кликнуто
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
            // Обновляем курсор в зависимости от того что под мышью
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

        // Передаем только координаты клика, WaveformCanvas сам разберется
        this.handleClick(x);
    }

    /**
     * Обработать клик по координатам X
     */
    handleClick(x) {
        const time = this.timeFromX(x);
        // console.log('🎯 WaveformCanvas: Клик по координате X:', x, 'время:', time);
        // console.log('🎯 WaveformCanvas: Текущая позиция красной полоски:', this.currentTime);

        // Определяем куда должна перепрыгнуть красная полоска
        let targetTime = time;

        // Если клик в пределах региона - перепрыгиваем туда
        if (time >= this.region.start && time <= this.region.end) {
            targetTime = time;
            // console.log('🎯 WaveformCanvas: Клик внутри региона, перепрыгиваем на:', targetTime);
        } else {
            // Если клик за пределами региона - перепрыгиваем на начало региона
            targetTime = this.region.start;
            // console.log('🎯 WaveformCanvas: Клик за пределами региона, перепрыгиваем на начало:', targetTime);
        }

        // Устанавливаем позицию playhead
        this.setCurrentTime(targetTime);
        // console.log('🎯 WaveformCanvas: После setCurrentTime красная полоска на:', this.currentTime);

        // Обновляем позицию аудио если оно играет
        this.updateAudioPosition(targetTime);

        if (this.callbacks.onSeek) {
            this.callbacks.onSeek(targetTime);
        }
    }

    /**
     * Обработчики событий касания
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
     * Получить цель попадания по координатам
     */
    getHitTarget(x, y) {
        if (this.duration === 0) return null;

        const halfHitZone = this.config.hitZoneSize / 2;

        // Проверяем указатель воспроизведения
        const playheadX = (this.playheadPosition / this.duration) * this.width;
        if (Math.abs(x - playheadX) <= halfHitZone && y <= 30) {
            return { type: 'playhead', x: playheadX };
        }

        // Проверяем маркер начала
        const startX = (this.region.start / this.duration) * this.width;
        if (Math.abs(x - startX) <= halfHitZone && y <= 30) {
            return { type: 'start', x: startX };
        }

        // Проверяем маркер конца
        const endX = (this.region.end / this.duration) * this.width;
        if (Math.abs(x - endX) <= halfHitZone && y <= 30) {
            return { type: 'end', x: endX };
        }

        return null;
    }

    /**
     * Преобразовать X координату во время
     */
    timeFromX(x) {
        if (this.duration === 0) return 0;
        return Math.max(0, Math.min((x / this.width) * this.duration, this.duration));
    }

    /**
     * Преобразовать время в X координату
     */
    xFromTime(time) {
        if (this.duration === 0) return 0;
        return (time / this.duration) * this.width;
    }

    /**
     * Показать волну (включить видимость всех элементов)
     */
    show() {
        if (this.container) {
            this.container.style.visibility = 'visible';
        }
        if (this.canvas) {
            this.canvas.style.visibility = 'visible';
        }
        console.log('🌊 WaveformCanvas: показана');
    }

    /**
     * Скрыть волну (выключить видимость всех элементов)
     */
    hide() {
        if (this.container) {
            this.container.style.visibility = 'hidden';
        }
        if (this.canvas) {
            this.canvas.style.visibility = 'hidden';
        }
        console.log('🌊 WaveformCanvas: скрыта');
    }

    /**
     * Проверить видима ли волна
     */
    isVisible() {
        return this.container && this.container.style.visibility !== 'hidden';
    }

    /**
     * Уничтожить волну и очистить ресурсы
     */
    destroy() {
        // Очищаем обработчики аудио
        this.stopAudioControl();

        if (this.audioContext) {
            this.audioContext.close();
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
