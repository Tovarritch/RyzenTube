package app.tizentube;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.regex.Pattern;

/** Loopback-only bridge for the opted-in Return YouTube Dislike feature.
 * YouTube's CSP permits loopback but does not permit the service's host.
 * This is deliberately not a general proxy: only a video ID is accepted.
 */
public final class DislikeService {
    private static final int PORT = 18945;
    private static final String ORIGIN = "https://www.youtube.com";
    private static final Pattern PATH = Pattern.compile("/votes\\?videoId=[A-Za-z0-9_-]{11}");
    private static boolean started;

    public static synchronized void start() {
        if (started) return;
        started = true;
        Thread listener = new Thread(() -> {
            ThreadPoolExecutor workers = new ThreadPoolExecutor(0, 2, 30, TimeUnit.SECONDS,
                    new SynchronousQueue<>(), task -> {
                        Thread thread = new Thread(task, "TizenTube-dislikes-request");
                        thread.setDaemon(true);
                        return thread;
                    });
            try (ServerSocket server = new ServerSocket(PORT, 4, InetAddress.getByName("127.0.0.1"))) {
                while (true) {
                    Socket client = server.accept();
                    try { workers.execute(() -> handle(client)); }
                    catch (RejectedExecutionException busy) { client.close(); }
                }
            } catch (IOException error) {
                System.err.println("TizenTube dislike bridge: " + error.getClass().getSimpleName());
            } finally {
                workers.shutdown();
                synchronized (DislikeService.class) { started = false; }
            }
        }, "TizenTube-dislikes-listener");
        listener.setDaemon(true);
        listener.start();
    }

    private static String line(InputStream input, int limit) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        for (int c; (c = input.read()) != -1;) {
            if (c == '\n') return bytes.toString("US-ASCII").replace("\r", "");
            if (bytes.size() >= limit) throw new IOException("Request too large");
            bytes.write(c);
        }
        throw new EOFException();
    }

    private static void handle(Socket client) {
        try (Socket socket = client) {
            socket.setSoTimeout(5000);
            InputStream input = new BufferedInputStream(socket.getInputStream());
            String[] request = line(input, 2048).split(" ");
            String origin = "";
            int total = 0;
            for (String header; !(header = line(input, 2048)).isEmpty();) {
                total += header.length();
                if (total > 8192) throw new IOException("Headers too large");
                int colon = header.indexOf(':');
                if (colon > 0 && header.substring(0, colon).equalsIgnoreCase("Origin"))
                    origin = header.substring(colon + 1).trim();
            }
            OutputStream output = socket.getOutputStream();
            if (!ORIGIN.equals(origin) || request.length != 3 || !PATH.matcher(request[1]).matches()) {
                respond(output, 403, "{}", false);
                return;
            }
            if (request[0].equals("OPTIONS")) {
                respond(output, 204, "", true);
                return;
            }
            if (!request[0].equals("GET")) {
                respond(output, 405, "{}", true);
                return;
            }
            // No cookies, authorization headers or arbitrary URL are forwarded.
            String id = request[1].substring("/votes?videoId=".length());
            HttpURLConnection connection = (HttpURLConnection) new URL(
                    "https://returnyoutubedislikeapi.com/Votes?videoId=" + id).openConnection();
            try {
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(8000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept", "application/json");
                int status = connection.getResponseCode();
                if (status != 200) { respond(output, 502, "{\"error\":\"Service HTTP " + status + "\"}", true); return; }
                try (InputStream body = connection.getInputStream()) {
                    ByteArrayOutputStream result = new ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    for (int count; (count = body.read(buffer)) != -1;) {
                        if (result.size() + count > 65536) throw new IOException("Response too large");
                        result.write(buffer, 0, count);
                    }
                    respond(output, 200, result.toString("UTF-8"), true);
                }
            } catch (IOException error) {
                respond(output, 502, "{\"error\":\"Dislike service unavailable\"}", true);
            } finally { connection.disconnect(); }
        } catch (IOException ignored) { /* Disconnected, malformed or timed-out local request. */ }
    }

    private static void respond(OutputStream output, int status, String body, boolean cors) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        String headers = "HTTP/1.1 " + status + " Response\r\nContent-Type: application/json\r\n"
                + "Content-Length: " + bytes.length + "\r\nConnection: close\r\nCache-Control: no-store\r\n";
        if (cors) headers += "Access-Control-Allow-Origin: " + ORIGIN + "\r\n"
                + "Access-Control-Allow-Methods: GET, OPTIONS\r\nAccess-Control-Allow-Private-Network: true\r\n";
        output.write((headers + "\r\n").getBytes(StandardCharsets.US_ASCII));
        output.write(bytes);
        output.flush();
    }
}
