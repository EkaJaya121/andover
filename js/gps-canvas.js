// ============================================================
// GPS CANVAS - REAL X/Y TRAJECTORY
// GPS pertama menjadi titik (0,0)
// X = Timur (+) / Barat (-) meter
// Y = Utara (+) / Selatan (-) meter
// ============================================================

const GPSRenderer = {
    canvas: document.getElementById('gps-canvas'),
    ctx: null,

    plotLeft: 58,
    plotRight: 24,
    plotTop: 32,
    plotBottom: 48,

    view: {
        centerX: 0,
        centerY: 0,
        metersPerPixel: 0.25,
        zoom: 5.0
    },

    init() {
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());
        this.draw();
    },

    resize() {
        if (!this.canvas || !this.ctx) return;

        const rect = this.canvas.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
            const dpr = window.devicePixelRatio || 1;

            this.canvas.width = Math.round(rect.width * dpr);
            this.canvas.height = Math.round(rect.height * dpr);

            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        this.draw();
    },

    resetView() {
        this.view.centerX = 0;
        this.view.centerY = 0;
        this.view.metersPerPixel = 0.25;
    },

    calculateView(points, W, H) {
        if (!points.length) return;
    
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
    
        const minX = Math.min(...xs, 0);
        const maxX = Math.max(...xs, 0);
        const minY = Math.min(...ys, 0);
        const maxY = Math.max(...ys, 0);
    
        const spanX = Math.max(maxX - minX, 2) * 1.25;
        const spanY = Math.max(maxY - minY, 2) * 1.25;
    
        const usableW = Math.max(
            W - this.plotLeft - this.plotRight,
            100
        );
    
        const usableH = Math.max(
            H - this.plotTop - this.plotBottom,
            100
        );
    
        const baseMetersPerPixel = Math.max(
            spanX / usableW,
            spanY / usableH,
            0.01
        );
    
        // Zoom IN
        this.view.metersPerPixel =
            baseMetersPerPixel / this.view.zoom;
    
        this.view.centerX = (minX + maxX) / 2;
        this.view.centerY = (minY + maxY) / 2;
    },

    mapX(x, W) {
        const usableW = W - this.plotLeft - this.plotRight;

        return this.plotLeft +
            ((x - this.view.centerX) / this.view.metersPerPixel) +
            usableW / 2;
    },

    mapY(y, H) {
        const usableH = H - this.plotTop - this.plotBottom;

        // Canvas Y ke bawah, sehingga koordinat GPS Y+ digambar ke atas.
        return this.plotTop +
            usableH / 2 -
            ((y - this.view.centerY) / this.view.metersPerPixel);
    },

    drawGrid(W, H) {
        const ctx = this.ctx;
        const usableW = W - this.plotLeft - this.plotRight;
        const usableH = H - this.plotTop - this.plotBottom;

        const centerX = this.mapX(this.view.centerX, W);
        const centerY = this.mapY(this.view.centerY, H);

        const rawStep = this.view.metersPerPixel * 70;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const normalized = rawStep / magnitude;

        let step;
        if (normalized < 2) step = magnitude;
        else if (normalized < 5) step = 2 * magnitude;
        else step = 5 * magnitude;

        const pixelStep = step / this.view.metersPerPixel;

        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;

        let firstX = centerX -
            Math.ceil((centerX - this.plotLeft) / pixelStep) * pixelStep;

        for (
            let px = firstX;
            px <= this.plotLeft + usableW;
            px += pixelStep
        ) {
            ctx.beginPath();
            ctx.moveTo(px, this.plotTop);
            ctx.lineTo(px, this.plotTop + usableH);
            ctx.stroke();
        }

        let firstY = centerY -
            Math.ceil((centerY - this.plotTop) / pixelStep) * pixelStep;

        for (
            let py = firstY;
            py <= this.plotTop + usableH;
            py += pixelStep
        ) {
            ctx.beginPath();
            ctx.moveTo(this.plotLeft, py);
            ctx.lineTo(this.plotLeft + usableW, py);
            ctx.stroke();
        }

        // X = 0
        if (centerX >= this.plotLeft && centerX <= this.plotLeft + usableW) {
            ctx.strokeStyle = 'rgba(30,64,175,0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(centerX, this.plotTop);
            ctx.lineTo(centerX, this.plotTop + usableH);
            ctx.stroke();
        }

        // Y = 0
        if (centerY >= this.plotTop && centerY <= this.plotTop + usableH) {
            ctx.strokeStyle = 'rgba(30,64,175,0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(this.plotLeft, centerY);
            ctx.lineTo(this.plotLeft + usableW, centerY);
            ctx.stroke();
        }

        // Label sumbu X
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Arial, sans-serif';

        const minVisibleX =
            this.view.centerX - usableW * this.view.metersPerPixel / 2;
        const maxVisibleX =
            this.view.centerX + usableW * this.view.metersPerPixel / 2;

        const startX = Math.floor(minVisibleX / step) * step;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let x = startX; x <= maxVisibleX; x += step) {
            const px = this.mapX(x, W);

            if (px >= this.plotLeft && px <= this.plotLeft + usableW) {
                ctx.fillText(`${x.toFixed(0)} m`, px, this.plotTop + usableH + 8);
            }
        }

        // Label sumbu Y
        const minVisibleY =
            this.view.centerY - usableH * this.view.metersPerPixel / 2;
        const maxVisibleY =
            this.view.centerY + usableH * this.view.metersPerPixel / 2;

        const startY = Math.floor(minVisibleY / step) * step;

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let y = startY; y <= maxVisibleY; y += step) {
            const py = this.mapY(y, H);

            if (py >= this.plotTop && py <= this.plotTop + usableH) {
                ctx.fillText(`${y.toFixed(0)} m`, this.plotLeft - 8, py);
            }
        }

        ctx.restore();
    },

    drawOrigin(W, H) {
        const ctx = this.ctx;
        const x = this.mapX(0, W);
        const y = this.mapY(0, H);

        if (
            x < this.plotLeft ||
            x > W - this.plotRight ||
            y < this.plotTop ||
            y > H - this.plotBottom
        ) return;

        ctx.save();

        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#16a34a';
        ctx.font = 'bold 10px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('START (0,0)', x + 9, y - 8);

        ctx.restore();
    },

    drawTrajectory(points, W, H) {
        const ctx = this.ctx;

        if (!points.length) return;

        ctx.save();

        if (points.length > 1) {
            ctx.beginPath();

            points.forEach((point, index) => {
                const x = this.mapX(point.x, W);
                const y = this.mapY(point.y, H);

                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        points.forEach((point, index) => {
            const x = this.mapX(point.x, W);
            const y = this.mapY(point.y, H);

            ctx.beginPath();
            ctx.arc(
                x,
                y,
                index === points.length - 1 ? 4 : 2,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                index === points.length - 1 ? '#dc2626' : '#2563eb';

            ctx.fill();
        });

        ctx.restore();
    },

    drawCurrentPosition(W, H) {
        const gps = window.GPSData;

        if (!gps || !gps.relativePosition) return;

        const point = gps.relativePosition;

        if (
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)
        ) return;

        const x = this.mapX(point.x, W);
        const y = this.mapY(point.y, H);

        const tel = gps.data || {};
        const heading = Number(tel.heading ?? tel.course);

        const ctx = this.ctx;

        ctx.save();
        ctx.translate(x, y);

        if (Number.isFinite(heading)) {
            ctx.rotate((heading * Math.PI) / 180);
        }

        // Bentuk kapal
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-9, -7);
        ctx.lineTo(-14, 0);
        ctx.lineTo(-9, 7);
        ctx.closePath();

        ctx.fillStyle = '#0f766e';
        ctx.fill();

        ctx.strokeStyle = '#083344';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();

        // Ring posisi
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(220,38,38,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Koordinat realtime
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        ctx.fillText(
            `X ${point.x.toFixed(2)} m | Y ${point.y.toFixed(2)} m`,
            x + 12,
            y - 12
        );
    },

    drawInfo(W, H) {
        const gps = window.GPSData;
        if (!gps) return;

        const ctx = this.ctx;
        const p = gps.relativePosition || { x: 0, y: 0 };

        ctx.save();

        const boxW = 205;
        const boxH = 58;
        const boxX = W - boxW - 12;
        const boxY = 10;

        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = 'rgba(15,23,42,0.12)';
        ctx.lineWidth = 1;

        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 7);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.strokeRect(boxX, boxY, boxW, boxH);
        }

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('GPS TRAJECTORY', boxX + 10, boxY + 8);

        ctx.font = '10px Arial, sans-serif';
        ctx.fillStyle = '#475569';

        ctx.fillText(
            `X: ${Number(p.x).toFixed(2)} m`,
            boxX + 10,
            boxY + 27
        );

        ctx.fillText(
            `Y: ${Number(p.y).toFixed(2)} m`,
            boxX + 105,
            boxY + 27
        );

        ctx.fillText(
            `GPS points: ${gps.pathHistory.length}`,
            boxX + 10,
            boxY + 43
        );

        ctx.restore();
    },

    draw() {
        if (!this.canvas || !this.ctx) return;

        const rect = this.canvas.getBoundingClientRect();
        const W = rect.width || 600;
        const H = rect.height || 400;

        const gps = window.GPSData;
        const points = gps ? gps.pathHistory : [];

        this.ctx.clearRect(0, 0, W, H);

        this.ctx.fillStyle = '#f8fafc';
        this.ctx.fillRect(0, 0, W, H);

        if (!points.length) {
            this.ctx.fillStyle = '#64748b';
            this.ctx.font = 'bold 13px Arial, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            this.ctx.fillText(
                'Menunggu GPS fix pertama...',
                W / 2,
                H / 2
            );

            return;
        }

        this.calculateView(points, W, H);
        this.drawGrid(W, H);
        this.drawOrigin(W, H);
        this.drawTrajectory(points, W, H);
        this.drawCurrentPosition(W, H);
        this.drawInfo(W, H);

        this.ctx.fillStyle = '#0f172a';
        this.ctx.font = 'bold 12px Arial, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        this.ctx.fillText(
            'TRAJECTORY MAPPING — GPS RELATIVE X/Y',
            10,
            10
        );
    }
};

window.GPSRenderer = GPSRenderer;
