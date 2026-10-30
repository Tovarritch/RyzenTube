package app.tizentube;

import android.media.AudioFormat;
import android.media.AudioTrack;
import java.io.*;
import java.lang.reflect.Field;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.regex.*;

/** Volume boost above 100%, applied to the sound samples Cobalt plays.
 *
 * On the TV, video sound goes from Cobalt's media pipeline straight to Android
 * audio tracks; neither the page's Web Audio nor Android audio effects
 * (LoudnessEnhancer was attached and enabled, yet inaudible on a Sony BRAVIA)
 * change it. So the samples are scaled right before Cobalt writes them:
 * prepare_android_shell.py calls process() at the start of AudioTrackBridge's
 * write methods. Only plain PCM (float or 16-bit) is touched, never encoded
 * surround (AC-3/E-AC-3). Above about 90% of full scale a soft limiter rounds
 * the peaks off instead of letting them clip into crackle.
 *
 * The page sets the level through a loopback request that only the YouTube
 * origin may make and that accepts nothing but a percentage.
 */
public final class VolumeBoost {
    private static final int PORT = 18947;
    private static final String ORIGIN = "https://www.youtube.com";
    private static final Pattern PATH = Pattern.compile("/boost\\?level=(\\d{3})");
    private static final float KNEE = 0.9f;
    private static volatile float gain = 1f;
    private static volatile int level = 100;
    private static volatile Field trackField;
    private static boolean started;
    // Reported to the page: which write path plays the sound, and its peaks.
    private static volatile String path = "none";
    private static volatile float peakIn, peakOut;

    /** Gain with a soft limit: unchanged below the knee, approaching 1.0 above it. */
    static float shape(float sample) {
        float boosted = sample * gain;
        float magnitude = Math.abs(boosted);
        if (magnitude <= KNEE) return boosted;
        float over = (magnitude - KNEE) / (1 - KNEE);
        float limited = KNEE + (1 - KNEE) * (float) Math.tanh(over);
        return boosted < 0 ? -limited : limited;
    }

    /** Float PCM (AudioTrackBridge.write(float[], int)). */
    public static void process(float[] data, int count) {
        path = "float";
        if (data == null) return;
        int end = Math.min(count, data.length);
        float in = 0, out = 0;
        for (int i = 0; i < end; i++) {
            in = Math.max(in, Math.abs(data[i]));
            if (gain != 1f) data[i] = shape(data[i]);
            out = Math.max(out, Math.abs(data[i]));
        }
        peakIn = Math.max(peakIn * 0.999f, in);
        peakOut = Math.max(peakOut * 0.999f, out);
    }

    /** Byte writes: 16-bit little-endian PCM only; encoded audio passes untouched. */
    public static void process(Object bridge, byte[] data, int size) {
        if (data == null) return;
        try {
            if (trackField == null) {
                Field field = bridge.getClass().getDeclaredField("mAudioTrack");
                field.setAccessible(true);
                trackField = field;
            }
            AudioTrack track = (AudioTrack) trackField.get(bridge);
            if (track == null) return;
            if (track.getAudioFormat() != AudioFormat.ENCODING_PCM_16BIT) { path = "encoded " + track.getAudioFormat(); return; }
            path = "pcm16";
        } catch (ReflectiveOperationException | RuntimeException error) {
            return;
        }
        int end = Math.min(size, data.length) & ~1;
        float in = 0, out = 0;
        for (int i = 0; i < end; i += 2) {
            short sample = (short) ((data[i] & 0xff) | (data[i + 1] << 8));
            float value = sample / 32768f;
            in = Math.max(in, Math.abs(value));
            if (gain == 1f) { out = Math.max(out, Math.abs(value)); continue; }
            int shaped = Math.round(shape(value) * 32767f);
            data[i] = (byte) shaped;
            data[i + 1] = (byte) (shaped >> 8);
            out = Math.max(out, Math.abs(shaped / 32768f));
        }
        peakIn = Math.max(peakIn * 0.999f, in);
        peakOut = Math.max(peakOut * 0.999f, out);
    }

    private static void setLevel(int percent) {
        level = Math.max(100, Math.min(300, percent));
        gain = level / 100f;
    }

    public static synchronized void start() {
        if (started) return;
        started = true;
        Thread listener = new Thread(() -> {
            try (ServerSocket server = new ServerSocket(PORT, 4, InetAddress.getByName("127.0.0.1"))) {
                while (true) {
                    try (Socket socket = server.accept()) { handle(socket); }
                    catch (IOException ignored) { /* Malformed or dropped request. */ }
                }
            } catch (IOException error) {
                System.err.println("TizenTube volume boost bridge: " + error.getClass().getSimpleName());
            } finally {
                synchronized (VolumeBoost.class) { started = false; }
            }
        }, "TizenTube-volume-boost");
        listener.setDaemon(true);
        listener.start();
    }

    private static String line(InputStream input) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        for (int c; (c = input.read()) != -1;) {
            if (c == '\n') return bytes.toString("US-ASCII").replace("\r", "");
            if (bytes.size() >= 2048) throw new IOException("Line too long");
            bytes.write(c);
        }
        throw new EOFException();
    }

    private static void handle(Socket socket) throws IOException {
        socket.setSoTimeout(5000);
        InputStream input = new BufferedInputStream(socket.getInputStream());
        String[] request = line(input).split(" ");
        String origin = "";
        for (String header; !(header = line(input)).isEmpty();) {
            int colon = header.indexOf(':');
            if (colon > 0 && header.substring(0, colon).equalsIgnoreCase("Origin")) origin = header.substring(colon + 1).trim();
        }
        OutputStream output = socket.getOutputStream();
        Matcher match = request.length == 3 ? PATH.matcher(request[1]) : null;
        if (!ORIGIN.equals(origin) || match == null || !match.matches()) { respond(output, 403, "{}"); return; }
        if (request[0].equals("OPTIONS")) { respond(output, 204, ""); return; }
        if (!request[0].equals("GET")) { respond(output, 405, "{}"); return; }
        setLevel(Integer.parseInt(match.group(1)));
        respond(output, 200, String.format(java.util.Locale.ROOT,
                "{\"level\":%d,\"path\":\"%s\",\"peakIn\":%.3f,\"peakOut\":%.3f}", level, path, peakIn, peakOut));
    }

    private static void respond(OutputStream output, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        String headers = "HTTP/1.1 " + status + " Response\r\nContent-Type: application/json\r\n"
                + "Content-Length: " + bytes.length + "\r\nConnection: close\r\nCache-Control: no-store\r\n"
                + "Access-Control-Allow-Origin: " + ORIGIN + "\r\nAccess-Control-Allow-Methods: GET, OPTIONS\r\n"
                + "Access-Control-Allow-Private-Network: true\r\n";
        output.write((headers + "\r\n").getBytes(StandardCharsets.US_ASCII));
        output.write(bytes);
        output.flush();
    }
}
