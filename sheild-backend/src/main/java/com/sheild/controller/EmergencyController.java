package com.sheild.controller;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.WriteBatch;
import com.sheild.service.FcmService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/emergency")
public class EmergencyController {

    @Autowired private Firestore firestore;
    @Autowired private FcmService fcmService;

    private String getUid() {
        return (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @PostMapping("/sos")
    public ResponseEntity<?> triggerSos(@RequestBody Map<String, Object> body) throws Exception {
        String uid = getUid();
        String sessionId = UUID.randomUUID().toString();
        
        Map<String, Object> session = new HashMap<>();
        session.put("id", sessionId);
        session.put("uid", uid);
        session.put("status", "active");
        session.put("type", "sos");
        session.put("startedAt", Timestamp.now());
        if (body.get("lat") != null) session.put("lat", body.get("lat"));
        if (body.get("lng") != null) session.put("lng", body.get("lng"));
        if (body.get("locationName") != null) session.put("locationName", body.get("locationName"));
        
        try {
            firestore.collection("emergencySessions").document(sessionId).set(session).get();
            notifyGuardCircle(uid, "sos", body, sessionId);
            
            Map<String, String> res = new HashMap<>();
            res.put("sessionId", sessionId);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
    }

    @PostMapping("/bodyguard")
    public ResponseEntity<?> triggerBodyguard(@RequestBody Map<String, Object> body) throws Exception {
        notifyGuardCircle(getUid(), "bodyguard", body, null);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/safe")
    public ResponseEntity<?> markSafe(@RequestBody Map<String, Object> body) throws Exception {
        String uid = getUid();
        
        try {
            // Find active sessions and resolve them
            var sessions = firestore.collection("emergencySessions")
                    .whereEqualTo("uid", uid)
                    .whereEqualTo("status", "active")
                    .get().get().getDocuments();
                    
            for (var doc : sessions) {
                doc.getReference().update(
                    "status", "resolved", 
                    "resolvedAt", Timestamp.now()
                ).get();
            }

            notifyGuardCircle(uid, "safe", body, null);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
    }

    @PostMapping("/share-location")
    public ResponseEntity<?> shareLocation(@RequestBody Map<String, Object> body) throws Exception {
        notifyGuardCircle(getUid(), "location", body, null);
        return ResponseEntity.ok(Map.of("success", true));
    }

    private void notifyGuardCircle(String uid, String type, Map<String, Object> location, String sessionId) throws Exception {
        var meDoc = firestore.collection("users").document(uid).get().get();
        @SuppressWarnings("unchecked")
        List<String> circle = (List<String>) meDoc.get("guardCircle");
        
        if (circle == null || circle.isEmpty()) return;
        
        String name = meDoc.getString("name");
        String message;
        String title;
        
        switch(type) {
            case "sos": 
                message = "🚨 SOS Triggered! " + name + " is in danger.";
                title = "🚨 EMERGENCY: " + name;
                break;
            case "bodyguard":
                message = name + " might be in danger. Stay alert.";
                title = "🛡️ Safety Alert: " + name;
                break;
            case "safe":
                message = name + " is now safe and secure.";
                title = name + " is Safe ✅";
                break;
            case "location":
                message = name + " shared live location with you.";
                title = "📍 Location Shared by " + name;
                break;
            default: return;
        }

        WriteBatch batch = firestore.batch();
        List<String> tokens = new ArrayList<>();
        
        try {
            for (String targetUid : circle) {
                Map<String, Object> notif = new HashMap<>();
                notif.put("type", type);
                notif.put("fromUid", uid);
                notif.put("fromName", meDoc.getString("name"));
                notif.put("fromUsername", meDoc.getString("username"));
                notif.put("fromAvatarUrl", meDoc.getString("avatarUrl"));
                notif.put("message", message);
                notif.put("read", false);
                notif.put("notifiedAt", Timestamp.now()); // use notifiedAt to avoid confusion with createdAt
                notif.put("createdAt", Timestamp.now());
                
                if (location.get("lat") != null && location.get("lng") != null) {
                    notif.put("lat", location.get("lat"));
                    notif.put("lng", location.get("lng"));
                    notif.put("mapsLink", "https://maps.google.com/?q=" + location.get("lat") + "," + location.get("lng"));
                }
                if (location.get("locationName") != null) notif.put("locationName", location.get("locationName"));
                
                batch.set(firestore.collection("notifications").document(targetUid).collection("items").document(), notif);
                
                var tDoc = firestore.collection("users").document(targetUid).get().get();
                String fcmToken = tDoc.getString("fcmToken");
                if (fcmToken != null && !fcmToken.isEmpty()) {
                    tokens.add(fcmToken);
                }
            }
            
            batch.commit().get();
        } catch (Exception e) {
             // In private helper, we might just let it bubble or log, but prompt says "In every Firestore operation... wrap in try catch"
             throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
        
        Map<String, String> data = new HashMap<>();
        data.put("type", type);
        data.put("fromUid", uid);
        data.put("fromName", name != null ? name : "");
        data.put("title", title);
        data.put("body", message);
        if (sessionId != null) data.put("sessionId", sessionId);
        
        fcmService.sendToTokens(tokens, type, title, message, data);
    }
}
