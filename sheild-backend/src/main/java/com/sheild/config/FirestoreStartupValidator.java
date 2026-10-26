package com.sheild.config;

import com.google.cloud.firestore.Firestore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Verifies Firestore is reachable on every startup.
 * A clear log line tells you immediately in Render logs whether
 * the database connection is healthy.
 */
@Component
public class FirestoreStartupValidator implements ApplicationRunner {

    @Autowired
    private Firestore firestore;

    @Override
    public void run(ApplicationArguments args) {
        // Run in background thread so cold-start TLS/OAuth handshakes don't block Tomcat or trigger false timeouts
        Thread validatorThread = new Thread(() -> {
            System.out.println("[Startup] Verifying Firestore connectivity...");
            int maxAttempts = 3;
            long[] timeoutsSeconds = { 30, 20, 15 };

            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    long timeout = timeoutsSeconds[attempt - 1];
                    var ref = firestore.collection("_health").document("startup-check");
                    ref.set(Map.of(
                        "ts",      System.currentTimeMillis(),
                        "service", "sheild-backend"
                    )).get(timeout, TimeUnit.SECONDS);
                    ref.delete().get(5, TimeUnit.SECONDS);

                    System.out.println("[Startup] ✅ Firestore connection verified — reads and writes are working (attempt " + attempt + ").");
                    return;
                } catch (Exception e) {
                    if (attempt < maxAttempts) {
                        System.out.println("[Startup] ⏳ Warming up Firestore gRPC channel (attempt " + attempt + " timed out, retrying in 3s)...");
                        try {
                            Thread.sleep(3000);
                        } catch (InterruptedException ignored) {}
                    } else {
                        System.err.println(
                            "[Startup] ❌ CRITICAL: Cannot connect to Firestore after " + maxAttempts + " attempts! " +
                            "All user data operations will fail with 503. " +
                            "→ Fix: ensure FIREBASE_SERVICE_ACCOUNT_KEY_JSON is correctly set on Render " +
                            "and the service account has 'Cloud Datastore User' or 'Firebase Admin' IAM role. " +
                            "Error: " + e.getMessage()
                        );
                    }
                }
            }
        }, "firestore-startup-validator");

        validatorThread.setDaemon(true);
        validatorThread.start();
    }
}
