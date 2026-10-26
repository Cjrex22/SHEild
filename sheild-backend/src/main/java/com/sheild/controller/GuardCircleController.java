package com.sheild.controller;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.FieldValue;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.WriteBatch;
import com.sheild.service.FcmService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/circle")
public class GuardCircleController {

    @Autowired private Firestore firestore;
    @Autowired private FcmService fcmService;

    private String getUid() {
        return (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getCircle() throws Exception {
        String uid = getUid();
        try {
            var snapshot = firestore.collection("users").document(uid).collection("guardCircleDetails").get().get();
            List<Map<String, Object>> results = new ArrayList<>();
            for (var doc : snapshot.getDocuments()) {
                results.add(doc.getData());
            }
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
    }

    @PostMapping("/{targetUid}")
    public ResponseEntity<?> addMember(@PathVariable String targetUid) throws Exception {
        String uid = getUid();
        
        try {
            var targetDoc = firestore.collection("users").document(targetUid).get().get();
            if (!targetDoc.exists()) return ResponseEntity.notFound().build();
            
            var meDoc = firestore.collection("users").document(uid).get().get();
            
            WriteBatch batch = firestore.batch();
            batch.update(firestore.collection("users").document(uid), "guardCircle", FieldValue.arrayUnion(targetUid));
            
            Map<String, Object> detail = new HashMap<>();
            detail.put("uid", targetUid);
            detail.put("name", targetDoc.getString("name"));
            detail.put("username", targetDoc.getString("username"));
            detail.put("avatarUrl", targetDoc.getString("avatarUrl"));
            detail.put("avatarColor", targetDoc.getString("avatarColor"));
            detail.put("addedAt", Timestamp.now());
            
            batch.set(firestore.collection("users").document(uid).collection("guardCircleDetails").document(targetUid), detail);
            
            String senderName = meDoc.getString("name");
            String senderUsername = meDoc.getString("username") != null ? meDoc.getString("username") : "";
            String notifMessage = senderName + " added you to their Guard Circle.";

            Map<String, Object> notif = new HashMap<>();
            notif.put("type", "circle_add");
            notif.put("fromUid", uid);
            notif.put("fromName", senderName);
            notif.put("fromUsername", senderUsername);
            notif.put("fromAvatarUrl", meDoc.getString("avatarUrl"));
            notif.put("message", notifMessage);
            notif.put("read", false);
            notif.put("createdAt", Timestamp.now());
            
            batch.set(firestore.collection("notifications").document(targetUid).collection("items").document(), notif);
            
            batch.commit().get();

            // Send FCM push notification to the invited user if they have a registered token
            String fcmToken = targetDoc.getString("fcmToken");
            if (fcmToken != null && !fcmToken.isEmpty()) {
                String pushTitle = "👥 Guard Circle Invite: " + (senderName != null ? senderName : "Guardian");
                Map<String, String> data = new HashMap<>();
                data.put("type", "circle_add");
                data.put("fromUid", uid);
                data.put("fromName", senderName != null ? senderName : "");
                data.put("fromUsername", senderUsername);
                List<String> tokens = new ArrayList<>();
                tokens.add(fcmToken);
                fcmService.sendToTokens(tokens, "circle_add", pushTitle, notifMessage, data);
            }

            return ResponseEntity.ok(detail);
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
    }

    @DeleteMapping("/{targetUid}")
    public ResponseEntity<?> removeMember(@PathVariable String targetUid) throws Exception {
        String uid = getUid();
        try {
            WriteBatch batch = firestore.batch();
            batch.update(firestore.collection("users").document(uid), "guardCircle", FieldValue.arrayRemove(targetUid));
            batch.delete(firestore.collection("users").document(uid).collection("guardCircleDetails").document(targetUid));
            batch.commit().get();
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
    }
}
