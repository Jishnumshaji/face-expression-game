import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

// Gesture recognition functions
const recognizeGesture = (landmarks) => {
  if (!landmarks || landmarks.length === 0) return null;
  
  // Check for two-handed gestures first
  if (landmarks.length === 2) {
    const twoHandGesture = recognizeTwoHandGesture(landmarks);
    if (twoHandGesture) return twoHandGesture;
  }
  
  // Single hand gestures
  const hand = landmarks[0];
  
  // Get key landmark points
  const thumb_tip = hand[4];
  const thumb_ip = hand[3];
  const thumb_mcp = hand[2];
  const index_tip = hand[8];
  const index_pip = hand[6];
  const middle_tip = hand[12];
  const ring_tip = hand[16];
  const pinky_tip = hand[20];
  const wrist = hand[0];
  
  // Korean Finger Heart Detection (single hand)
  const koreanHeartResult = isKoreanHeart(thumb_tip, index_tip, thumb_ip, index_pip, wrist);
  if (koreanHeartResult.detected) {
    return { gesture: 'korean_heart', confidence: koreanHeartResult.confidence, debugInfo: koreanHeartResult.debugInfo };
  }
  
  // Thumbs Up Detection
  if (isThumbsUp(thumb_tip, thumb_ip, thumb_mcp, index_tip, middle_tip, ring_tip, pinky_tip, wrist)) {
    return { gesture: 'thumbs_up', confidence: 0.8 };
  }
  
  // Thumbs Down Detection
  if (isThumbsDown(thumb_tip, thumb_ip, thumb_mcp, index_tip, middle_tip, ring_tip, pinky_tip, wrist)) {
    return { gesture: 'thumbs_down', confidence: 0.8 };
  }
  
  // Love Sign Detection (I Love You in ASL)
  if (isLoveSign(thumb_tip, index_tip, middle_tip, ring_tip, pinky_tip, wrist)) {
    return { gesture: 'love_sign', confidence: 0.8 };
  }
  
  // Peace Sign Detection
  if (isPeaceSign(index_tip, middle_tip, ring_tip, pinky_tip, index_pip)) {
    return { gesture: 'peace_sign', confidence: 0.8 };
  }
  
  return null;
};

const recognizeTwoHandGesture = (landmarks) => {
  const leftHand = landmarks[0];
  const rightHand = landmarks[1];
  
  // Two-handed heart gesture
  const twoHandHeartResult = isTwoHandedHeart(leftHand, rightHand);
  if (twoHandHeartResult.detected) {
    return { gesture: 'two_hand_heart', confidence: twoHandHeartResult.confidence, debugInfo: twoHandHeartResult.debugInfo };
  }
  
  return null;
};

const isKoreanHeart = (thumb_tip, index_tip, thumb_ip, index_pip, wrist) => {
  // Korean finger heart: thumb and index finger tips touch to form a small heart
  const distance = Math.sqrt(
    Math.pow(thumb_tip.x - index_tip.x, 2) + 
    Math.pow(thumb_tip.y - index_tip.y, 2)
  );
  
  // Tips should be very close together (relaxed threshold for better detection)
  const tipsClose = distance < 0.05;
  
  // Both fingers should be positioned above the wrist (gesture held up)
  const fingersRaised = 
    thumb_tip.y < wrist.y - 0.02 && 
    index_tip.y < wrist.y - 0.02;
  
  // Check that fingers are actually bent toward each other
  const thumbBent = thumb_tip.y < thumb_ip.y - 0.01;
  const indexBent = index_tip.y < index_pip.y - 0.01;
  
  // Both fingers should be extended (not completely folded)
  const fingersExtended = 
    Math.sqrt(Math.pow(thumb_tip.x - wrist.x, 2) + Math.pow(thumb_tip.y - wrist.y, 2)) > 0.05 &&
    Math.sqrt(Math.pow(index_tip.x - wrist.x, 2) + Math.pow(index_tip.y - wrist.y, 2)) > 0.05;
  
  // Calculate confidence score
  let confidence = 0;
  if (tipsClose) confidence += 0.4;
  if (fingersRaised) confidence += 0.2;
  if (thumbBent) confidence += 0.15;
  if (indexBent) confidence += 0.15;
  if (fingersExtended) confidence += 0.1;
  
  // Store debug info for this gesture
  const debugInfo = {
    distance: distance.toFixed(3),
    tipsClose,
    fingersRaised,
    thumbBent,
    indexBent,
    fingersExtended,
    confidence: (confidence * 100).toFixed(1)
  };
  
  return confidence > 0.6 ? { detected: true, confidence, debugInfo } : { detected: false, confidence, debugInfo };
};

const isTwoHandedHeart = (leftHand, rightHand) => {
  // Get key points for both hands
  const leftThumb = leftHand[4];
  const leftIndex = leftHand[8];
  const leftMiddle = leftHand[12];
  const leftWrist = leftHand[0];
  const rightThumb = rightHand[4];
  const rightIndex = rightHand[8];
  const rightMiddle = rightHand[12];
  const rightWrist = rightHand[0];
  
  // Both hands should be raised above wrist level
  const handsRaised = 
    leftThumb.y < leftWrist.y - 0.03 && leftIndex.y < leftWrist.y - 0.03 &&
    rightThumb.y < rightWrist.y - 0.03 && rightIndex.y < rightWrist.y - 0.03;
  
  // Calculate distances
  const thumbDistance = Math.sqrt(
    Math.pow(leftThumb.x - rightThumb.x, 2) + 
    Math.pow(leftThumb.y - rightThumb.y, 2)
  );
  
  const indexDistance = Math.sqrt(
    Math.pow(leftIndex.x - rightIndex.x, 2) + 
    Math.pow(leftIndex.y - rightIndex.y, 2)
  );
  
  // Heart shape requirements - thumbs should be closer than index fingers
  const thumbsClose = thumbDistance < 0.18; // Reasonably close
  const indexesSeparated = indexDistance > thumbDistance * 1.2; // Index fingers must be more separated
  
  // Proper heart shape - index fingers should be below thumbs
  const heartShape = 
    leftIndex.y > leftThumb.y + 0.02 && 
    rightIndex.y > rightThumb.y + 0.02;
  
  // Hands should be at similar height
  const sameHeight = Math.abs(leftThumb.y - rightThumb.y) < 0.12;
  
  // Hands should be facing inward toward each other
  const leftFacingRight = leftThumb.x < leftIndex.x;
  const rightFacingLeft = rightThumb.x > rightIndex.x;
  const facingEachOther = leftFacingRight && rightFacingLeft;
  
  // Hands should be close horizontally but not overlapping
  const handsClose = Math.abs(leftWrist.x - rightWrist.x) < 0.5 && Math.abs(leftWrist.x - rightWrist.x) > 0.1;
  
  // Additional validation - fingers should be somewhat extended (not fists)
  const leftFingersExtended = 
    Math.sqrt(Math.pow(leftIndex.x - leftWrist.x, 2) + Math.pow(leftIndex.y - leftWrist.y, 2)) > 0.08;
  const rightFingersExtended = 
    Math.sqrt(Math.pow(rightIndex.x - rightWrist.x, 2) + Math.pow(rightIndex.y - rightWrist.y, 2)) > 0.08;
  const fingersExtended = leftFingersExtended && rightFingersExtended;
  
  // Calculate confidence score with stricter requirements
  let confidence = 0;
  if (handsRaised) confidence += 0.2;
  if (thumbsClose) confidence += 0.2;
  if (indexesSeparated) confidence += 0.15;
  if (heartShape) confidence += 0.15;
  if (sameHeight) confidence += 0.1;
  if (facingEachOther) confidence += 0.1;
  if (handsClose) confidence += 0.05;
  if (fingersExtended) confidence += 0.05;
  
  // Store debug info
  const debugInfo = {
    thumbDistance: thumbDistance.toFixed(3),
    indexDistance: indexDistance.toFixed(3),
    handsRaised,
    thumbsClose,
    indexesSeparated,
    heartShape,
    sameHeight,
    facingEachOther,
    handsClose,
    fingersExtended,
    confidence: (confidence * 100).toFixed(1)
  };
  
  return confidence > 0.65 ? { detected: true, confidence, debugInfo } : { detected: false, confidence, debugInfo };
};

const isThumbsUp = (thumb_tip, thumb_ip, thumb_mcp, index_tip, middle_tip, ring_tip, pinky_tip, wrist) => {
  // Thumb should be extended upward (tip higher than joints)
  const thumbExtended = thumb_tip.y < thumb_ip.y && thumb_ip.y < thumb_mcp.y;
  
  // Thumb should be significantly above the wrist
  const thumbUp = thumb_tip.y < wrist.y - 0.08;
  
  // Other fingers should be curled down (tips should be close to or below wrist level)
  const otherFingersCurled = 
    index_tip.y > wrist.y - 0.03 &&
    middle_tip.y > wrist.y - 0.03 &&
    ring_tip.y > wrist.y - 0.03 &&
    pinky_tip.y > wrist.y - 0.03;
  
  // Thumb should be relatively isolated (not too close to other fingers)
  const thumbIsolated = 
    Math.sqrt(Math.pow(thumb_tip.x - index_tip.x, 2) + Math.pow(thumb_tip.y - index_tip.y, 2)) > 0.05;
  
  return thumbExtended && thumbUp && otherFingersCurled && thumbIsolated;
};

const isThumbsDown = (thumb_tip, thumb_ip, thumb_mcp, index_tip, middle_tip, ring_tip, pinky_tip, wrist) => {
  // Thumb should be extended downward (tip lower than joints)
  const thumbExtended = thumb_tip.y > thumb_ip.y && thumb_ip.y > thumb_mcp.y;
  
  // Thumb should be significantly below the wrist
  const thumbDown = thumb_tip.y > wrist.y + 0.08;
  
  // Other fingers should be curled up (tips should be close to or above wrist level)
  const otherFingersCurled = 
    index_tip.y < wrist.y + 0.03 &&
    middle_tip.y < wrist.y + 0.03 &&
    ring_tip.y < wrist.y + 0.03 &&
    pinky_tip.y < wrist.y + 0.03;
  
  // Thumb should be relatively isolated (not too close to other fingers)
  const thumbIsolated = 
    Math.sqrt(Math.pow(thumb_tip.x - index_tip.x, 2) + Math.pow(thumb_tip.y - index_tip.y, 2)) > 0.05;
  
  return thumbExtended && thumbDown && otherFingersCurled && thumbIsolated;
};

const isLoveSign = (thumb_tip, index_tip, middle_tip, ring_tip, pinky_tip, wrist) => {
  // Thumb, index, and pinky should be extended
  const thumbExtended = thumb_tip.y < wrist.y - 0.1;
  const indexExtended = index_tip.y < wrist.y - 0.1;
  const pinkyExtended = pinky_tip.y < wrist.y - 0.1;
  
  // Middle and ring fingers should be folded
  const middleRingFolded = 
    middle_tip.y > wrist.y - 0.05 &&
    ring_tip.y > wrist.y - 0.05;
  
  return thumbExtended && indexExtended && pinkyExtended && middleRingFolded;
};

const isPeaceSign = (index_tip, middle_tip, ring_tip, pinky_tip, index_pip) => {
  // Index and middle fingers should be extended and separated
  const indexExtended = index_tip.y < index_pip.y;
  const middleExtended = middle_tip.y < index_pip.y;
  
  // Ring and pinky should be folded
  const ringPinkyFolded = 
    ring_tip.y > index_pip.y &&
    pinky_tip.y > index_pip.y;
  
  // Fingers should be separated (V shape)
  const separated = Math.abs(index_tip.x - middle_tip.x) > 0.05;
  
  return indexExtended && middleExtended && ringPinkyFolded && separated;
};

const HandGestureDetector = ({ onGestureDetected, onNoGestureDetected, isActive }) => {
  const videoRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const gestureHistoryRef = useRef([]);
  const HISTORY_SIZE = 5; // Number of recent detections to consider

  useEffect(() => {
    if (!isActive) return;

    const initializeHands = async () => {
      const hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 2, // Allow detection of both hands
        modelComplexity: 0, // Reduced for faster detection
        minDetectionConfidence: 0.3, // Very low for better sensitivity
        minTrackingConfidence: 0.3   // Very low for better sensitivity
      });

      hands.onResults((results) => {
        let detectedGestureData = null;
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          detectedGestureData = recognizeGesture(results.multiHandLandmarks);
        }
        
        // Add to gesture history with confidence data
        gestureHistoryRef.current.push(detectedGestureData);
        if (gestureHistoryRef.current.length > HISTORY_SIZE) {
          gestureHistoryRef.current.shift();
        }
        
        // Count occurrences and calculate average confidence for each gesture
        const gestureStats = {};
        gestureHistoryRef.current.forEach(data => {
          if (data && data.gesture) {
            if (!gestureStats[data.gesture]) {
              gestureStats[data.gesture] = { count: 0, totalConfidence: 0 };
            }
            gestureStats[data.gesture].count++;
            gestureStats[data.gesture].totalConfidence += data.confidence;
          }
        });
        
        // Find the most frequent gesture with highest average confidence
        let bestGesture = null;
        let maxScore = 0;
        
        for (const [gesture, stats] of Object.entries(gestureStats)) {
          // Two hand heart needs more consistency due to complexity
          const requiredCount = gesture === 'two_hand_heart' ? 3 : 2;
          
          if (stats.count >= requiredCount) {
            const avgConfidence = stats.totalConfidence / stats.count;
            const score = (stats.count / HISTORY_SIZE) * avgConfidence;
            
            if (score > maxScore) {
              bestGesture = { 
                gesture, 
                confidence: avgConfidence,
                consistency: (stats.count / HISTORY_SIZE * 100).toFixed(0),
                debugInfo: detectedGestureData?.debugInfo
              };
              maxScore = score;
            }
          }
        }
        
        if (bestGesture) {
          onGestureDetected(bestGesture.gesture, bestGesture.confidence, bestGesture);
        } else if (onNoGestureDetected) {
          onNoGestureDetected();
        }
      });

      handsRef.current = hands;
      setIsInitialized(true);
    };

    initializeHands();
  }, [isActive, onGestureDetected, onNoGestureDetected]);

  useEffect(() => {
    if (!isInitialized || !isActive || !videoRef.current) return;

    const startCamera = async () => {
      try {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 480,
          height: 360
        });

        cameraRef.current = camera;
        camera.start();
      } catch (error) {
        console.error('Error starting camera for hand detection:', error);
      }
    };

    startCamera();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [isInitialized, isActive]);

  if (!isActive) return null;

  return (
    <video
      ref={videoRef}
      style={{
        position: 'absolute',
        opacity: 0,
        pointerEvents: 'none',
        width: 1,
        height: 1
      }}
      playsInline
    />
  );
};

export default HandGestureDetector;
