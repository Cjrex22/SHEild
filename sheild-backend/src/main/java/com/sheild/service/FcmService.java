package com.sheild.service;

import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.WebpushConfig;
import com.google.firebase.messaging.WebpushFcmOptions;
import com.google.firebase.messaging.WebpushNotification;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class FcmService {

    private static final String SHIELD_ICON_URL = "https://sheild-app-prod-1234.web.app/shield-logo.png";
    private static final String SHIELD_BADGE_URL = "https://sheild-app-prod-1234.web.app/shield-badge.png";

    public void sendToTokens(List<String> tokens, String type,
        String title, String body, Map<String,String> data) {
        if (tokens == null || tokens.isEmpty()) return;
        
        try {
            boolean isSos = "sos".equalsIgnoreCase(type);
            boolean isLocation = "location".equalsIgnoreCase(type);

            WebpushNotification.Builder webpushNotifBuilder = WebpushNotification.builder()
                .setTitle(title)
                .setBody(body)
                .setIcon(SHIELD_ICON_URL)
                .setBadge(SHIELD_BADGE_URL)
                .setRequireInteraction(isSos);

            if (isLocation) {
                webpushNotifBuilder.addAction(new WebpushNotification.Action("open_google_maps", "🗺️ View on Google Maps"));
            }

            WebpushConfig.Builder webpushConfigBuilder = WebpushConfig.builder()
                .setNotification(webpushNotifBuilder.build())
                .putHeader("Urgency", isSos ? "high" : "normal");

            String mapsLink = data != null ? data.get("mapsLink") : null;
            if (mapsLink != null && !mapsLink.isEmpty()) {
                webpushConfigBuilder.setFcmOptions(WebpushFcmOptions.builder().setLink(mapsLink).build());
            }

            Map<String, String> payloadData = new java.util.HashMap<>(data != null ? data : Map.of());
            payloadData.put("icon", SHIELD_ICON_URL);
            payloadData.put("badge", SHIELD_BADGE_URL);

            MulticastMessage message = MulticastMessage.builder()
                .addAllTokens(tokens)
                .putAllData(payloadData)
                .setNotification(com.google.firebase.messaging.Notification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build())
                .setAndroidConfig(AndroidConfig.builder()
                    .setPriority(isSos ?
                        AndroidConfig.Priority.HIGH : AndroidConfig.Priority.NORMAL)
                    .build())
                .setWebpushConfig(webpushConfigBuilder.build())
                .build();

            BatchResponse response = FirebaseMessaging.getInstance()
                .sendEachForMulticast(message);
        } catch (Exception e) {
            System.err.println("FCM sending failed: " + e.getMessage());
        }
    }
}
