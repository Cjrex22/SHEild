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

    @PostMapping("/invite/{targetUid}")
    public ResponseEntity<?> inviteMember(@PathVariable String targetUid) throws Exception {
        String uid = getUid();
        try {
            var targetDoc = firestore.collection("users").document(targetUid).get().get();
            if (!targetDoc.exists()) return ResponseEntity.notFound().build();

            var meDoc = firestore.collection("users").document(uid).get().get();

            WriteBatch batch = firestore.batch();

            // Set pending record on inviter's side (NOT in guardCircle array yet!)
            Map<String, Object> detail = new HashMap<>();
            detail.put("uid", targetUid);
            detail.put("name", targetDoc.getString("name"));
            detail.put("username", targetDoc.getString("username"));
            detail.put("avatarUrl", targetDoc.getString("avatarUrl"));
            detail.put("avatarColor", targetDoc.getString("avatarColor"));
            detail.put("status", "pending");
            detail.put("role", "inviter");
            detail.put("accepted", false);
            detail.put("addedAt", Timestamp.now());
            batch.set(firestore.collection("users").document(uid).collection("guardCircleDetails").document(targetUid), detail);

            // Clean up any stale record on target user's side
            batch.delete(firestore.collection("users").document(targetUid).collection("guardCircleDetails").document(uid));

            String senderName = meDoc.getString("name");
            String senderUsername = meDoc.getString("username") != null ? meDoc.getString("username") : "";
            String notifMessage = senderName + " invited you to their Guard Circle.";

            Map<String, Object> notif = new HashMap<>();
            notif.put("type", "circle_add");
            notif.put("fromUid", uid);
            notif.put("fromName", senderName);
            notif.put("fromUsername", senderUsername);
            notif.put("fromAvatarUrl", meDoc.getString("avatarUrl"));
            notif.put("message", notifMessage);
            notif.put("read", false);
            notif.put("accepted", false);
            notif.put("declined", false);
            notif.put("createdAt", Timestamp.now());

            batch.set(firestore.collection("notifications").document(targetUid).collection("items").document(), notif);
            batch.commit().get();

            // Send FCM push notification to target user
            String fcmToken = targetDoc.getString("fcmToken");
            if (fcmToken != null && !fcmToken.isEmpty()) {
                String pushTitle = "👥 Guard Circle Invite: " + (senderName != null ? senderName : "Guardian");
                Map<String, String> data = new HashMap<>();
                data.put("type", "circle_add");
                data.put("fromUid", uid);
                data.put("fromName", senderName != null ? senderName : "");
                data.put("name", senderName != null ? senderName : "");
                data.put("senderName", senderName != null ? senderName : "");
                data.put("fromUsername", senderUsername);
                data.put("title", pushTitle);
                data.put("body", notifMessage);
                List<String> tokens = new ArrayList<>();
                tokens.add(fcmToken);
                fcmService.sendToTokens(tokens, "circle_add", pushTitle, notifMessage, data);
            }

            return ResponseEntity.ok(detail);
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
    }

    @PostMapping("/accept/{targetUid}")
    public ResponseEntity<?> acceptMember(@PathVariable String targetUid) throws Exception {
        String uid = getUid();
        try {
            var targetDoc = firestore.collection("users").document(targetUid).get().get();
            if (!targetDoc.exists()) return ResponseEntity.notFound().build();

            var meDoc = firestore.collection("users").document(uid).get().get();

            WriteBatch batch = firestore.batch();

            // Mutually add both users to each other's guardCircle array
            batch.update(firestore.collection("users").document(uid), "guardCircle", FieldValue.arrayUnion(targetUid));
            batch.update(firestore.collection("users").document(targetUid), "guardCircle", FieldValue.arrayUnion(uid));

            // Set accepted details for me
            Map<String, Object> myDetail = new HashMap<>();
            myDetail.put("uid", targetUid);
            myDetail.put("name", targetDoc.getString("name"));
            myDetail.put("username", targetDoc.getString("username"));
            myDetail.put("avatarUrl", targetDoc.getString("avatarUrl"));
            myDetail.put("avatarColor", targetDoc.getString("avatarColor"));
            myDetail.put("status", "accepted");
            myDetail.put("role", "invitee");
            myDetail.put("accepted", true);
            myDetail.put("connectedAt", Timestamp.now());
            batch.set(firestore.collection("users").document(uid).collection("guardCircleDetails").document(targetUid), myDetail);

            // Set accepted details for target user
            Map<String, Object> theirDetail = new HashMap<>();
            theirDetail.put("uid", uid);
            theirDetail.put("name", meDoc.getString("name"));
            theirDetail.put("username", meDoc.getString("username"));
            theirDetail.put("avatarUrl", meDoc.getString("avatarUrl"));
            theirDetail.put("avatarColor", meDoc.getString("avatarColor"));
            theirDetail.put("status", "accepted");
            theirDetail.put("role", "inviter");
            theirDetail.put("accepted", true);
            theirDetail.put("connectedAt", Timestamp.now());
            batch.set(firestore.collection("users").document(targetUid).collection("guardCircleDetails").document(uid), theirDetail);

            // Mark any incoming invite notification from targetUid as accepted and read
            try {
                var notifs = firestore.collection("notifications").document(uid).collection("items")
                        .whereEqualTo("fromUid", targetUid).get().get().getDocuments();
                for (var n : notifs) {
                    batch.update(n.getReference(), "accepted", true, "read", true);
                }
            } catch (Exception ignored) {}

            String senderName = meDoc.getString("name");
            String senderUsername = meDoc.getString("username") != null ? meDoc.getString("username") : "";
            String notifMessage = senderName + " accepted your Guard Circle invitation.";

            Map<String, Object> notif = new HashMap<>();
            notif.put("type", "circle_accepted");
            notif.put("fromUid", uid);
            notif.put("fromName", senderName);
            notif.put("fromUsername", senderUsername);
            notif.put("fromAvatarUrl", meDoc.getString("avatarUrl"));
            notif.put("message", notifMessage);
            notif.put("read", false);
            notif.put("accepted", true);
            notif.put("createdAt", Timestamp.now());

            batch.set(firestore.collection("notifications").document(targetUid).collection("items").document(), notif);
            batch.commit().get();

            // Push notification to target user
            String fcmToken = targetDoc.getString("fcmToken");
            if (fcmToken != null && !fcmToken.isEmpty()) {
                String pushTitle = "✅ Connected with " + (senderName != null ? senderName : "Guardian");
                Map<String, String> data = new HashMap<>();
                data.put("type", "circle_accepted");
                data.put("fromUid", uid);
                data.put("fromName", senderName != null ? senderName : "");
                data.put("name", senderName != null ? senderName : "");
                data.put("senderName", senderName != null ? senderName : "");
                data.put("fromUsername", senderUsername);
                data.put("title", pushTitle);
                data.put("body", notifMessage);
                List<String> tokens = new ArrayList<>();
                tokens.add(fcmToken);
                fcmService.sendToTokens(tokens, "circle_accepted", pushTitle, notifMessage, data);
            }

            return ResponseEntity.ok(myDetail);
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
    }

    @PostMapping("/{targetUid}")
    public ResponseEntity<?> addMember(@PathVariable String targetUid) throws Exception {
        String uid = getUid();
        try {
            // Check if there is an incoming pending invite from targetUid to me
            var myNotifs = firestore.collection("notifications").document(uid).collection("items")
                    .whereEqualTo("fromUid", targetUid).get().get().getDocuments();
            boolean isIncomingInvite = false;
            for (var doc : myNotifs) {
                String type = doc.getString("type");
                Boolean accepted = doc.getBoolean("accepted");
                Boolean declined = doc.getBoolean("declined");
                if (("circle_add".equals(type) || "circle".equals(type)) && !Boolean.TRUE.equals(accepted) && !Boolean.TRUE.equals(declined)) {
                    isIncomingInvite = true;
                    break;
                }
            }

            if (isIncomingInvite) {
                return acceptMember(targetUid);
            } else {
                return inviteMember(targetUid);
            }
        } catch (Exception e) {
            return inviteMember(targetUid);
        }
    }

    @DeleteMapping("/{targetUid}")
    public ResponseEntity<?> removeMember(@PathVariable String targetUid) throws Exception {
        String uid = getUid();
        try {
            WriteBatch batch = firestore.batch();
            batch.update(firestore.collection("users").document(uid), "guardCircle", FieldValue.arrayRemove(targetUid));
            batch.delete(firestore.collection("users").document(uid).collection("guardCircleDetails").document(targetUid));
            batch.update(firestore.collection("users").document(targetUid), "guardCircle", FieldValue.arrayRemove(uid));
            batch.delete(firestore.collection("users").document(targetUid).collection("guardCircleDetails").document(uid));
            batch.commit().get();
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable. Please try again.");
        }
    }
}
