// ============================================================
// GPS TELEMETRY CLIENT - REAL GPS TRAJECTORY
// GPS fix pertama = titik (0,0)
// X = East (+) / West (-) dalam meter
// Y = North (+) / South (-) dalam meter
// ============================================================

const GPSData = {
    data: {
        lat: null,
        lon: null,
        speed: null,
        course: null,
        heading: null,
        fix: false
    },

    pathHistory: [],
    MAX_PATH_LENGTH: 2000,

    // GPS pertama pada sesi menjadi titik nol.
    origin: {
        lat: null,
        lon: null
    },

    relativePosition: {
        x: 0,
        y: 0
    },

    fetchInProgress: false,
    lastSuccessfulFetch: null,
    sessionId: null,

    geofence: {
        enabled: true,
        centerLat: -5.370700,
        centerLon: 105.299875,
        radiusMeter: 35
    },

    geofenceViolation: false,
    geofenceDistance: 0,

    normalizeTelemetry(data) {
        const telemetry = data || {};
        const speed = telemetry.speed ?? telemetry.speed_knots ?? null;

        return {
            ...telemetry,
            lat: telemetry.lat ?? telemetry.latitude ?? null,
            lon: telemetry.lon ?? telemetry.longitude ?? null,
            speed,
            course: telemetry.course ?? telemetry.course_over_ground ?? null,
            fix: Boolean(telemetry.fix ?? telemetry.gps_valid)
        };
    },

    // GPS latitude/longitude -> koordinat lokal meter.
    // X positif = Timur, X negatif = Barat.
    // Y positif = Utara, Y negatif = Selatan.
    gpsToXY(lat, lon) {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return null;
        }

        if (!Number.isFinite(this.origin.lat) || !Number.isFinite(this.origin.lon)) {
            this.origin.lat = lat;
            this.origin.lon = lon;

            console.log(
                `[GPS] Origin: lat=${lat.toFixed(7)}, lon=${lon.toFixed(7)} -> (0,0)`
            );
        }

        const R = 6371000;
        const lat0 = this.origin.lat * Math.PI / 180;

        const dLat = (lat - this.origin.lat) * Math.PI / 180;
        const dLon = (lon - this.origin.lon) * Math.PI / 180;

        return {
            x: dLon * Math.cos(lat0) * R,
            y: dLat * R
        };
    },

    resetTrajectory() {
        this.pathHistory = [];
        this.origin = {
            lat: null,
            lon: null
        };
        this.relativePosition = {
            x: 0,
            y: 0
        };

        console.log('[GPS] Trajectory reset. GPS fix berikutnya menjadi (0,0).');

        if (window.GPSRenderer) {
            window.GPSRenderer.resetView();
            window.GPSRenderer.draw();
        }
    },

    checkGeofence(lat, lon) {
        if (
            !this.geofence.enabled ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {
            return;
        }

        const R = 6371e3;
        const lat1 = this.geofence.centerLat * Math.PI / 180;
        const lat2 = lat * Math.PI / 180;
        const deltaLat = (lat - this.geofence.centerLat) * Math.PI / 180;
        const deltaLon = (lon - this.geofence.centerLon) * Math.PI / 180;

        const a =
            Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(deltaLon / 2) ** 2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        this.geofenceDistance = distance;
        this.geofenceViolation = distance > this.geofence.radiusMeter;
    },

    updateTrajectory(data) {
        if (
            !data.fix ||
            !Number.isFinite(Number(data.lat)) ||
            !Number.isFinite(Number(data.lon))
        ) {
            return;
        }

        const lat = Number(data.lat);
        const lon = Number(data.lon);
        const xy = this.gpsToXY(lat, lon);

        if (!xy) return;

        this.relativePosition = xy;
        this.checkGeofence(lat, lon);

        const lastPoint = this.pathHistory[this.pathHistory.length - 1];

        // Simpan titik baru hanya jika bergeser minimal 1 cm.
        if (
            !lastPoint ||
            Math.hypot(xy.x - lastPoint.x, xy.y - lastPoint.y) >= 0.01
        ) {
            this.pathHistory.push({
                x: xy.x,
                y: xy.y,
                lat,
                lon,
                timestamp: Date.now()
            });

            if (this.pathHistory.length > this.MAX_PATH_LENGTH) {
                this.pathHistory.shift();
            }
        }
    },

    async fetch() {
        if (this.fetchInProgress) return;

        this.fetchInProgress = true;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        try {
            const response = await fetch(CONFIG.TELEMETRY, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error('GPS telemetry request failed');
            }

            const data = this.normalizeTelemetry(await response.json());

            if (
                data.session_id &&
                this.sessionId &&
                data.session_id !== this.sessionId
            ) {
                this.resetTrajectory();
            }

            if (data.session_id) {
                this.sessionId = data.session_id;
            }

            this.data = data;
            this.lastSuccessfulFetch = Date.now();

            this.updateTrajectory(data);

        } catch (error) {
            console.error('[GCS] Error fetching GPS telemetry:', error);

            this.data = {
                ...this.data,
                gps_valid: false
            };

        } finally {
            clearTimeout(timeoutId);
            this.fetchInProgress = false;
        }

        if (window.VehicleState) {
            window.VehicleState.render(this.data);
            window.VehicleState.pathHistory = this.pathHistory;
        }

        if (window.GPSRenderer) {
            window.GPSRenderer.draw();
        }
    }
};

window.GPSData = GPSData;

setInterval(() => GPSData.fetch(), CONFIG.POLL_INTERVALS.TELEMETRY);
GPSData.fetch();
