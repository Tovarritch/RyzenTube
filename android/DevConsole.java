package app.tizentube;

import java.io.*;
import java.math.BigInteger;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/** DEBUG APKs ONLY (prepare_android_shell.py --debug-console). Never in a release.
 *
 * A development console for the TV: the PC sends JavaScript over adb, the page
 * (dbgs/userScript.js) runs it and sends the result back.
 *
 *   PC  --POST /cmd, GET /wait (token)-->  this loopback server  <--GET /poll, POST /result--  page
 *
 * Sending commands needs the token printed to logcat at start; other apps on
 * the TV cannot read logcat, adb can. The page endpoints only answer the
 * YouTube origin.
 */
public final class DevConsole {
    private static final int PORT = 18946;
    private static final String ORIGIN = "https://www.youtube.com";
    private static final String TOKEN = new BigInteger(130, new SecureRandom()).toString(32);
    private static final BlockingQueue<String[]> commands = new LinkedBlockingQueue<>();
    private static final Map<String, String> results = new ConcurrentHashMap<>();
    private static final AtomicInteger ids = new AtomicInteger();
    private static boolean started;

    public static synchronized void start() {
        if (started) return;
        started = true;
        System.out.println("TTDEV token=" + TOKEN + " port=" + PORT);
        Thread listener = new Thread(() -> {
            ExecutorService workers = new ThreadPoolExecutor(0, 6, 30, TimeUnit.SECONDS, new SynchronousQueue<>(), task -> {
                Thread thread = new Thread(task, "TizenTube-devconsole-request");
                thread.setDaemon(true);
                return thread;
            });
            try (ServerSocket server = new ServerSocket(PORT, 8, InetAddress.getByName("127.0.0.1"))) {
                while (true) {
                    Socket client = server.accept();
                    try { workers.execute(() -> handle(client)); }
                    catch (RejectedExecutionException busy) { client.close(); }
                }
            } catch (IOException error) {
                System.err.println("TTDEV console stopped: " + error);
            } finally {
                workers.shutdown();
                synchronized (DevConsole.class) { started = false; }
            }
        }, "TizenTube-devconsole-listener");
        listener.setDaemon(true);
        listener.start();
    }

    private static String line(InputStream input) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        for (int c; (c = input.read()) != -1;) {
            if (c == '\n') return bytes.toString("UTF-8").replace("\r", "");
            if (bytes.size() >= 8192) throw new IOException("Line too long");
            bytes.write(c);
        }
        throw new EOFException();
    }

    private static void handle(Socket client) {
        try (Socket socket = client) {
            socket.setSoTimeout(70000);
            InputStream input = new BufferedInputStream(socket.getInputStream());
            String[] request = line(input).split(" ");
            String origin = "", token = "";
            int length = 0;
            for (String header; !(header = line(input)).isEmpty();) {
                int colon = header.indexOf(':');
                if (colon <= 0) continue;
                String name = header.substring(0, colon).trim(), value = header.substring(colon + 1).trim();
                if (name.equalsIgnoreCase("Origin")) origin = value;
                else if (name.equalsIgnoreCase("X-TT-Token")) token = value;
                else if (name.equalsIgnoreCase("Content-Length")) length = Integer.parseInt(value);
            }
            if (request.length != 3 || length < 0 || length > 4 << 20) throw new IOException("Bad request");
            byte[] body = new byte[length];
            for (int read = 0; read < length;) {
                int count = input.read(body, read, length - read);
                if (count < 0) throw new EOFException();
                read += count;
            }
            String method = request[0], path = request[1];
            OutputStream output = socket.getOutputStream();
            boolean page = ORIGIN.equals(origin);
            boolean pc = origin.isEmpty() && MessageDigestEquals.same(TOKEN, token);

            if (page && method.equals("OPTIONS")) { respond(output, 204, "", true); return; }
            if (page && method.equals("GET") && path.equals("/poll")) {
                String[] command = commands.poll(20, TimeUnit.SECONDS);
                if (command == null) respond(output, 204, "", true);
                else respond(output, 200, "{\"id\":\"" + command[0] + "\",\"code\":" + quote(command[1]) + "}", true);
                return;
            }
            if (page && method.equals("POST") && path.startsWith("/result?id=")) {
                String id = path.substring("/result?id=".length());
                results.put(id, new String(body, StandardCharsets.UTF_8));
                synchronized (results) { results.notifyAll(); }
                respond(output, 200, "{}", true);
                return;
            }
            if (pc && method.equals("POST") && path.equals("/cmd")) {
                String id = String.valueOf(ids.incrementAndGet());
                commands.add(new String[] { id, new String(body, StandardCharsets.UTF_8) });
                respond(output, 200, "{\"id\":\"" + id + "\"}", false);
                return;
            }
            if (pc && method.equals("GET") && path.startsWith("/wait?id=")) {
                String id = path.substring("/wait?id=".length());
                long until = System.currentTimeMillis() + 60000;
                String result;
                synchronized (results) {
                    while ((result = results.remove(id)) == null && System.currentTimeMillis() < until) results.wait(1000);
                }
                if (result == null) respond(output, 504, "{\"error\":\"No answer from the page (is a YouTube page open?)\"}", false);
                else respond(output, 200, result, false);
                return;
            }
            respond(output, 403, "{}", page);
        } catch (IOException | InterruptedException | NumberFormatException ignored) { /* Malformed or dropped request. */ }
    }

    private static String quote(String text) {
        StringBuilder out = new StringBuilder("\"");
        for (char c : text.toCharArray()) {
            if (c == '"' || c == '\\') out.append('\\').append(c);
            else if (c < 0x20 || c > 0x7e) out.append(String.format("\\u%04x", (int) c));
            else out.append(c);
        }
        return out.append('"').toString();
    }

    private static void respond(OutputStream output, int status, String body, boolean cors) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        String headers = "HTTP/1.1 " + status + " Response\r\nContent-Type: application/json\r\n"
                + "Content-Length: " + bytes.length + "\r\nConnection: close\r\nCache-Control: no-store\r\n";
        if (cors) headers += "Access-Control-Allow-Origin: " + ORIGIN + "\r\n"
                + "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n"
                + "Access-Control-Allow-Private-Network: true\r\n";
        output.write((headers + "\r\n").getBytes(StandardCharsets.US_ASCII));
        output.write(bytes);
        output.flush();
    }

    /** Constant-time token comparison. */
    private static final class MessageDigestEquals {
        static boolean same(String expected, String given) {
            return java.security.MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
        }
    }
}
