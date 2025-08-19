import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import './App.css';
import { isRock } from './gestureDetection';

// Timing constants - Optimized for better performance
const TIMING = {
  MATCH_COOLDOWN: 2000,
  ANIMATION_DURATION: 1500,
  DETECTION_INTERVAL: 1200, // Increased from 1000ms for better performance
  MESSAGE_TIMEOUT: 2000,
  GESTURE_DETECTION_INTERVAL: 700, // Increased from 500ms for better performance
  WINK_DETECTION_INTERVAL: 800, // Special faster interval for wink detection
};

const expressions = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'disgusted',
  //'fearful',
  'wink',
];

const gestures = [
  'thumbs_up',
  'thumbs_down',
  'korean_heart', // Added Korean heart gesture
  'rock', // Added rock gesture
];

const allTargets = [...expressions, ...gestures];

const expressionEmojis = {
  'neutral': '😐',
  'happy': '😄',
  'sad': '😢',
  'angry': '😠',
  'surprised': '😲',
  'disgusted': '🤢',
  //'fearful': '😨',
  'wink': '😉'
};

const gestureEmojis = {
  'thumbs_up': '👍',
  'thumbs_down': '👎',
  'korean_heart': '🤏💖', // Added Korean heart emoji
  'rock': '🤘' // Added rock gesture emoji
};

const allEmojis = { ...expressionEmojis, ...gestureEmojis };

// Utility function to shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Generate a new randomized game sequence
function generateGameSequence() {
  return shuffleArray(allTargets);
}

// Get next target from current game sequence
function getNextTarget(gameSequence, currentIndex) {
  if (currentIndex >= gameSequence.length) {
    // Game completed, generate new sequence
    const newSequence = generateGameSequence();
    return { target: newSequence[0], newSequence, newIndex: 0 };
  }
  return { target: gameSequence[currentIndex], newSequence: gameSequence, newIndex: currentIndex };
}

function getRandomTarget() {
  return allTargets[Math.floor(Math.random() * allTargets.length)];
}

function App() {
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  // Game sequence management - no repeated targets
  const [gameSequence, setGameSequence] = useState(() => generateGameSequence());
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  const [targetExpression, setTargetExpression] = useState('');
  const [gameProgress, setGameProgress] = useState(1); // Track progress through sequence
  const [isProcessingMatch, setIsProcessingMatch] = useState(false); // Prevent double processing
  const [gameActive, setGameActive] = useState(false); // Control when game is running
  const [gameStarted, setGameStarted] = useState(false); // Track if game has ever been started
  
  // Initialize target expression after gameSequence is set
  useEffect(() => {
    if (gameSequence.length > 0 && !targetExpression) {
      setTargetExpression(gameSequence[0]);
    }
  }, [gameSequence, targetExpression]);
  
  const [userExpression, setUserExpression] = useState('');
  const [userGesture, setUserGesture] = useState('');
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [webcamOn, setWebcamOn] = useState(true);
  const [showAnimation, setShowAnimation] = useState(true);
  const [lastMatchTime, setLastMatchTime] = useState(0);
  const [handsInstance, setHandsInstance] = useState(null);
  const [gestureDetectionActive, setGestureDetectionActive] = useState(false);

  // Enhanced hand gesture recognition with better accuracy
  const recognizeGesture = useCallback((landmarks) => {
    if (!landmarks || landmarks.length === 0) return null;
    
    const hand = landmarks[0]; // Use first detected hand
    
    try {
      // Get key landmark points (MediaPipe hand landmarks - 21 points)
      const thumb_tip = hand[4];      // Thumb tip
      const thumb_ip = hand[3];       // Thumb IP joint
      const thumb_mcp = hand[2];      // Thumb MCP joint
      const index_tip = hand[8];      // Index finger tip
      const index_pip = hand[6];      // Index finger PIP
      const index_mcp = hand[5];      // Index finger MCP
      const middle_tip = hand[12];    // Middle finger tip
      const middle_pip = hand[10];    // Middle finger PIP
      const ring_tip = hand[16];      // Ring finger tip
      const ring_pip = hand[14];      // Ring finger PIP
      const pinky_tip = hand[20];     // Pinky tip
      const pinky_pip = hand[18];     // Pinky PIP
      const wrist = hand[0];          // Wrist
      
      // Calculate distances and angles for better detection
      const thumbLength = Math.abs(thumb_tip.y - thumb_mcp.y);
      const wristToThumbDistance = Math.abs(thumb_tip.y - wrist.y);
      
      // Korean Heart Detection (check first to avoid conflicts)
      const isKoreanHeart = () => {
        // Calculate distance between thumb and index finger tips
        const thumbIndexDistance = Math.sqrt(
          Math.pow(thumb_tip.x - index_tip.x, 2) + 
          Math.pow(thumb_tip.y - index_tip.y, 2)
        );
        
        // 1. Main condition: thumb and index very close (pinching gesture)
        const isPinching = thumbIndexDistance < 0.06; // Tighter threshold for more accuracy
        
        // 2. Both thumb and index should be roughly at same level (not extreme up/down)
        const thumbIndexLevelCheck = Math.abs(thumb_tip.y - index_tip.y) < 0.05;
        
        // 3. Exclude clear thumbs up position (thumb significantly above wrist AND other fingers curled)
        const thumbWayAbove = thumb_tip.y < (wrist.y - 0.1);
        const otherFingersCurled = middle_tip.y > middle_pip.y && ring_tip.y > ring_pip.y;
        const notClearThumbsUp = !(thumbWayAbove && otherFingersCurled);
        
        // 4. Exclude clear thumbs down position  
        const thumbWayBelow = thumb_tip.y > (wrist.y + 0.1);
        const notClearThumbsDown = !thumbWayBelow;
        
        // 5. Additional check: thumb and index should be positioned in front (closer to camera)
        const thumbIndexInFront = thumb_tip.z < wrist.z && index_tip.z < wrist.z;
        
        console.log('Korean Heart Check:', {
          isPinching,
          thumbIndexLevelCheck,
          notClearThumbsUp,
          notClearThumbsDown,
          thumbIndexInFront,
          thumbIndexDistance: thumbIndexDistance.toFixed(4),
          thumbTip: { x: thumb_tip.x.toFixed(3), y: thumb_tip.y.toFixed(3) },
          indexTip: { x: index_tip.x.toFixed(3), y: index_tip.y.toFixed(3) },
          wrist: { x: wrist.x.toFixed(3), y: wrist.y.toFixed(3) },
          thumbVsWrist: (thumb_tip.y - wrist.y).toFixed(3),
          indexVsWrist: (index_tip.y - wrist.y).toFixed(3)
        });
        
        return isPinching && thumbIndexLevelCheck && notClearThumbsUp && notClearThumbsDown && thumbIndexInFront;
      };
      
      // Enhanced Thumbs Up Detection (more strict to avoid Korean heart conflicts)
      const isThumbsUp = () => {
        // 1. Thumb should be extended upward
        const thumbPointsUp = thumb_tip.y < thumb_ip.y && thumb_ip.y < thumb_mcp.y;
        
        // 2. Thumb should be significantly above wrist (stricter threshold)
        const thumbAboveWrist = thumb_tip.y < (wrist.y - 0.08);
        
        // 3. Other fingers should be curled (using multiple checks)
        const indexCurled = index_tip.y > index_pip.y && index_tip.y > index_mcp.y;
        const middleCurled = middle_tip.y > middle_pip.y;
        const ringCurled = ring_tip.y > ring_pip.y;
        const pinkyCurled = pinky_tip.y > pinky_pip.y;
        
        // 4. Majority of fingers should be curled
        const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;
        const fingersCurled = curledCount >= 3;
        
        // 5. Thumb should be reasonably extended
        const thumbExtended = wristToThumbDistance > 0.06; // Stricter threshold
        
        // 6. NEW: Exclude pinching gesture (thumb and index close together)
        const thumbIndexDistance = Math.sqrt(
          Math.pow(thumb_tip.x - index_tip.x, 2) + 
          Math.pow(thumb_tip.y - index_tip.y, 2)
        );
        const notPinching = thumbIndexDistance > 0.08; // If pinching, not thumbs up
        
        console.log('Thumbs Up Check:', {
          thumbPointsUp,
          thumbAboveWrist,
          fingersCurled,
          thumbExtended,
          notPinching,
          curledCount,
          thumbIndexDistance: thumbIndexDistance.toFixed(4),
          thumbTip: { x: thumb_tip.x.toFixed(3), y: thumb_tip.y.toFixed(3) },
          wrist: { x: wrist.x.toFixed(3), y: wrist.y.toFixed(3) },
          thumbVsWrist: (thumb_tip.y - wrist.y).toFixed(3),
          thumbVsWristThreshold: -0.08
        });
        
        return thumbPointsUp && thumbAboveWrist && fingersCurled && thumbExtended && notPinching;
      };
      
      // Enhanced Thumbs Down Detection
      const isThumbsDown = () => {
        // 1. Thumb should be extended downward
        const thumbPointsDown = thumb_tip.y > thumb_ip.y && thumb_ip.y > thumb_mcp.y;
        
        // 2. Thumb should be significantly below wrist
        const thumbBelowWrist = thumb_tip.y > (wrist.y + 0.06);
        
        // 3. Other fingers should be curled upward
        const indexCurled = index_tip.y < index_pip.y && index_tip.y < index_mcp.y;
        const middleCurled = middle_tip.y < middle_pip.y;
        const ringCurled = ring_tip.y < ring_pip.y;
        const pinkyCurled = pinky_tip.y < pinky_pip.y;
        
        // 4. Majority of fingers should be curled
        const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;
        const fingersCurled = curledCount >= 3;
        
        // 5. Thumb should be reasonably extended
        const thumbExtended = wristToThumbDistance > 0.05;
        
        console.log('Thumbs Down Check:', {
          thumbPointsDown,
          thumbBelowWrist,
          fingersCurled,
          thumbExtended,
          curledCount
        });
        
        return thumbPointsDown && thumbBelowWrist && fingersCurled && thumbExtended;
      };
      
      // Return gesture with priority (Korean heart first to avoid conflicts)
      const koreanHeartResult = isKoreanHeart();
      const rockResult = isRock(landmarks);
      const thumbsUpResult = isThumbsUp();
      const thumbsDownResult = isThumbsDown();
      
      // Debug output for all gesture checks
      console.log('🔍 GESTURE DETECTION RESULTS:');
      console.log('   Korean Heart:', koreanHeartResult);
      console.log('   Rock:', rockResult);
      console.log('   Thumbs Up:', thumbsUpResult);
      console.log('   Thumbs Down:', thumbsDownResult);
      
      if (koreanHeartResult) {
        console.log('💖 KOREAN HEART DETECTED');
        return 'korean_heart';
      }
      if (rockResult) {
        console.log('🤘 ROCK DETECTED');
        return 'rock';
      }
      if (thumbsUpResult) {
        console.log('✅ THUMBS UP DETECTED');
        return 'thumbs_up';
      }
      if (thumbsDownResult) {
        console.log('✅ THUMBS DOWN DETECTED');
        return 'thumbs_down';
      }
      
      return null;
    } catch (error) {
      console.warn('Error in gesture recognition:', error);
      return null;
    }
  }, []);

  // Initialize MediaPipe Hands with simplified, working implementation
  useEffect(() => {
    let hands = null;
    let isActive = true;
    
    const initializeHands = async () => {
      try {
        console.log('Initializing MediaPipe Hands...');
        
        // Simplified MediaPipe loading - use CDN directly
        if (!window.Hands) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
          document.head.appendChild(script);
          
          await new Promise((resolve, reject) => {
            script.onload = () => {
              console.log('MediaPipe Hands script loaded from CDN');
              resolve();
            };
            script.onerror = () => reject(new Error('Failed to load MediaPipe script'));
            setTimeout(() => reject(new Error('MediaPipe script load timeout')), 10000);
          });
        }

        if (!window.Hands) {
          throw new Error('MediaPipe Hands not available after loading');
        }

        hands = new window.Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });

        // Configure with optimal settings for gesture recognition
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1, // Better accuracy for gestures
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
          staticImageMode: false
        });

        hands.onResults((results) => {
          if (!isActive) return; // Prevent processing after cleanup
          
          try {
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
              const gesture = recognizeGesture(results.multiHandLandmarks);
              if (gesture) {
                console.log('Detected gesture:', gesture);
                setUserGesture(gesture);
                // Only check for match if current target is a gesture
                if (gestures.includes(targetExpression)) {
                  checkForMatch(gesture);
                }
              } else {
                setUserGesture('');
              }
            } else {
              setUserGesture('');
            }
          } catch (error) {
            console.warn('Error processing hand results:', error);
          }
        });

        // Remove the non-existent onError method
        // MediaPipe Hands doesn't have this method

        if (isActive) {
          setHandsInstance(hands);
          setGestureDetectionActive(true);
          console.log('MediaPipe Hands initialized successfully');
        }
      } catch (error) {
        console.warn('MediaPipe Hands initialization failed:', error);
        setGestureDetectionActive(false);
        setHandsInstance(null);
      }
    };

    if (webcamOn) {
      initializeHands();
    }

    return () => {
      isActive = false;
      if (hands) {
        try {
          hands.close();
        } catch (error) {
          console.warn('Error closing MediaPipe Hands:', error);
        }
      }
      setHandsInstance(null);
      setGestureDetectionActive(false);
    };
  }, [webcamOn, recognizeGesture, targetExpression]);

  // Hand gesture detection loop with simplified video processing
  useEffect(() => {
    let gestureInterval;
    let isActive = true;
    
    if (handsInstance && gestureDetectionActive && webcamOn && gameActive && gestures.includes(targetExpression)) {
      console.log('Starting gesture detection for target:', targetExpression);
      
      gestureInterval = setInterval(async () => {
        if (!isActive || !webcamRef.current || !handsInstance) return;
        
        const video = webcamRef.current.video;
        if (video && video.readyState === 4 && video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            // Send video directly to MediaPipe (simpler approach)
            await handsInstance.send({ image: video });
          } catch (error) {
            console.warn('Hand detection processing error:', error);
            // Fallback: try with canvas if direct video fails
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              await handsInstance.send({ image: canvas });
            } catch (fallbackError) {
              console.warn('Canvas fallback also failed:', fallbackError);
            }
          }
        }
      }, TIMING.GESTURE_DETECTION_INTERVAL);
    } else if (gestureInterval) {
      clearInterval(gestureInterval);
    }

    return () => {
      isActive = false;
      if (gestureInterval) {
        clearInterval(gestureInterval);
      }
    };
  }, [handsInstance, gestureDetectionActive, webcamOn, gameActive, targetExpression]);

  const checkForMatch = (detected) => {
    // Only check for matches when game is active
    if (!gameActive) {
      return; // Game not started, ignore detections
    }
    
    const currentTime = Date.now();
    
    // Strict validation to prevent double processing
    if (detected !== targetExpression) {
      return; // Not the target expression
    }
    
    if (isProcessingMatch) {
      console.log('🔒 Match processing already in progress, ignoring duplicate');
      return; // Already processing a match
    }
    
    if (currentTime - lastMatchTime <= 3000) { // Increased cooldown to 3 seconds
      console.log('⏱️ Cooldown active, ignoring match');
      return; // Cooldown active
    }
    
    // Mark as processing to prevent duplicates
    setIsProcessingMatch(true);
    console.log('✅ Processing valid match for:', detected);
    
    // Increment score immediately with state protection
    setScore(prevScore => {
      const newScore = prevScore + 1;
      console.log('📊 Score updated:', prevScore, '→', newScore);
      return newScore;
    });
    
    setShowAnimation(true);
    setLastMatchTime(currentTime);
    
    // Calculate next target info
    const nextIndex = currentTargetIndex + 1;
    const isGameComplete = nextIndex >= gameSequence.length;
    
    if (isGameComplete) {
      console.log('🎊 Game sequence completed! Final score:', score + 1);
      setMessage(`🎊 Game Complete! Final Score: ${score + 1}/12 - Click "New Game" to play again!`);
      setGameActive(false); // Stop the game
      
      // Generate new game sequence and reset, but don't auto-start
      setTimeout(() => {
        const newSequence = generateGameSequence();
        console.log('🎮 Game ended, new sequence ready:', newSequence);
        
        setGameSequence(newSequence);
        setCurrentTargetIndex(0);
        setTargetExpression(newSequence[0]);
        setGameProgress(1);
        setScore(0); // Reset score for next player
        setLastMatchTime(0); // Reset cooldown timer
        setMessage('🎮 Game Complete! Click "New Game" to start fresh.');
        setShowAnimation(false);
        setIsProcessingMatch(false); // Release lock
        console.log('🔄 Game ready for next player');
        
        // Clear the message after a longer delay since game is stopped
        setTimeout(() => setMessage(''), 5000);
      }, 3000); // Slightly longer delay to show final score
    } else {
      console.log('➡️ Advancing to next target:', nextIndex, '/', gameSequence.length);
      setMessage(`🎉 Correct! +1 Point (${nextIndex}/${gameSequence.length})`);
      
      // Move to next target in current sequence
      setTimeout(() => {
        setCurrentTargetIndex(nextIndex);
        setTargetExpression(gameSequence[nextIndex]);
        setGameProgress(nextIndex + 1);
        setMessage('');
        setShowAnimation(false);
        setIsProcessingMatch(false); // Release lock
        console.log('🎯 Next target set:', gameSequence[nextIndex]);
      }, 1500);
    }
  };

  const checkExpression = () => {
    const currentDetection = gestures.includes(targetExpression) ? userGesture : userExpression;
    
    if (currentDetection === targetExpression) {
      setScore(score + 1);
      setMessage('Correct!');
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 1200);
    } else {
      const currentDisplay = currentDetection || 'None';
      setMessage(`Try again! You showed: ${currentDisplay}`);
      setShowAnimation(false);
    }
  };

  useEffect(() => {
    // Test animation for 2 seconds
    const timer = setTimeout(() => setShowAnimation(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log('Loading face recognition models...');
        const MODEL_URL = '/models';
        
        console.log('Loading tiny face detector...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        
        console.log('Loading face expression net...');
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        
        console.log('Loading face landmarks...');
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        
        console.log('All models loaded successfully!');
        setModelsLoaded(true);
      } catch (error) {
        console.error('Error loading models:', error);
        setMessage('Error loading face recognition models');
      }
    };
    loadModels();
  }, []);

useEffect(() => {
  let interval;
  if (modelsLoaded && webcamOn && gameActive && !gestures.includes(targetExpression)) {
    console.log('Starting face expression detection for target:', targetExpression);
    
    // Use faster detection for wink, slower for other expressions
    const detectionInterval = targetExpression === 'wink' ? 
      TIMING.WINK_DETECTION_INTERVAL : 
      TIMING.DETECTION_INTERVAL;
    
    console.log(`Using ${detectionInterval}ms detection interval for ${targetExpression}`);
    
    interval = setInterval(async () => {
      if (webcamRef.current && webcamRef.current.video.readyState === 4) {
        try {
          // Get both expressions and landmarks for wink detection (correct order)
          const detections = await faceapi
            .detectSingleFace(webcamRef.current.video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

          if (detections) {
            let currentExpression = null;

            // Default: get strongest expression from face-api
            if (detections.expressions) {
              const sorted = Object.entries(detections.expressions).sort((a, b) => b[1] - a[1]);
              currentExpression = sorted[0][0];
              // Removed base expression logging to reduce clutter
            }

            // Enhanced wink detection using landmarks (always check, overrides other expressions if detected)
            if (detections.landmarks) {
              const leftEye = detections.landmarks.getLeftEye();
              const rightEye = detections.landmarks.getRightEye();

              // Calculate Eye Aspect Ratio (EAR) for each eye - improved formula
              const calculateEAR = (eye) => {
                // Vertical distances between eyelid points
                const A = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
                const B = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
                // Horizontal distance between eye corners
                const C = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
                return (A + B) / (2.0 * C);
              };

              const leftEAR = calculateEAR(leftEye);
              const rightEAR = calculateEAR(rightEye);

              // Adjusted wink detection thresholds based on user testing
              const winkThresholdClosed = 0.27; // Eye considered closed if EAR < this
              const winkThresholdOpen = 0.28;    // Eye considered open if EAR > this
              const earDifference = Math.abs(leftEAR - rightEAR);

              // More sensitive wink detection logic
              const leftEyeClosed = leftEAR < winkThresholdClosed;
              const rightEyeClosed = rightEAR < winkThresholdClosed;
              const leftEyeOpen = leftEAR > winkThresholdOpen;
              const rightEyeOpen = rightEAR > winkThresholdOpen;
              
              // Much more sensitive difference threshold
              const significantDifference = earDifference > 0.01;

              // Reduced wink logging - only when wink is detected
              // if (Math.random() < 0.2) {
              //   console.log('👁️ Eye tracking - Left EAR:', leftEAR.toFixed(3), 'Right EAR:', rightEAR.toFixed(3), 'Diff:', earDifference.toFixed(3));
              //   console.log('   Wink check - LeftClosed:', leftEyeClosed, 'RightOpen:', rightEyeOpen, 'RightClosed:', rightEyeClosed, 'LeftOpen:', leftEyeOpen);
              //   console.log('   SignificantDiff:', significantDifference, 'Threshold:', earDifference.toFixed(3), '> 0.01');
              // }

              // Check for tongue out (optional enhancement for wink)
              let tongueOut = false;
              try {
                const mouth = detections.landmarks.getMouth();
                if (mouth.length >= 20) {
                  // Calculate mouth opening and lip positions
                  const upperLip = mouth[13]; // Upper lip center
                  const lowerLip = mouth[19]; // Lower lip center
                  const leftCorner = mouth[0]; // Left mouth corner
                  const rightCorner = mouth[6]; // Right mouth corner
                  
                  const mouthHeight = Math.abs(upperLip.y - lowerLip.y);
                  const mouthWidth = Math.abs(leftCorner.x - rightCorner.x);
                  const mouthRatio = mouthHeight / mouthWidth;
                  
                  // Tongue out typically creates a more elongated mouth opening
                  tongueOut = mouthRatio > 0.3; // Adjust threshold as needed
                  
                  if (Math.random() < 0.1) { // Occasional tongue debug
                    console.log('👅 Tongue check - MouthRatio:', mouthRatio.toFixed(3), 'TongueOut:', tongueOut);
                  }
                }
              } catch (error) {
                // Tongue detection is optional, don't break wink detection
              }

              // Enhanced wink detection: basic wink OR wink with tongue
              const basicWink = significantDifference && ((leftEyeClosed && rightEyeOpen) || (rightEyeClosed && leftEyeOpen));
              const winkWithTongue = tongueOut && (leftEyeClosed || rightEyeClosed); // More relaxed with tongue
              
              if (basicWink || winkWithTongue) {
                currentExpression = 'wink';
                const detectionType = basicWink ? 'basic wink' : 'wink with tongue';
                console.log('😉 WINK DETECTED!', detectionType, '- Left EAR:', leftEAR.toFixed(3), 'Right EAR:', rightEAR.toFixed(3), 'Tongue:', tongueOut);
              }
            }

            // Set the detected expression
            if (currentExpression) {
              setUserExpression(currentExpression);
              checkForMatch(currentExpression);
            }
          }
        } catch (error) {
          console.error('Error in face detection:', error);
        }
      }
    }, detectionInterval);
  }
  return () => clearInterval(interval);
}, [modelsLoaded, webcamOn, gameActive, targetExpression, lastMatchTime]);

  const startNewGame = () => {
    console.log('🔄 Starting new game...');
    setScore(0);
    setLastMatchTime(0);
    setIsProcessingMatch(false); // Reset processing state
    
    // Generate new game sequence for fresh start
    const newSequence = generateGameSequence();
    setGameSequence(newSequence);
    setCurrentTargetIndex(0);
    setTargetExpression(newSequence[0]);
    setGameProgress(1);
    
    // Start the game!
    setGameActive(true);
    setGameStarted(true);
    
    setMessage('🎮 Game Started! Match the expressions and gestures!');
    setTimeout(() => setMessage(''), 2500);
    console.log('🎮 New game sequence:', newSequence);
  };

  const stopGame = () => {
    console.log('⏸️ Stopping game...');
    setGameActive(false);
    setIsProcessingMatch(false);
    setUserExpression('');
    setUserGesture('');
    
    setMessage('⏸️ Game Paused. Progress saved. Click "Resume" to continue or "New Game" to restart.');
    setTimeout(() => setMessage(''), 4000);
    console.log('⏸️ Game stopped, progress preserved');
  };

  const resumeGame = () => {
    console.log('▶️ Resuming game...');
    setGameActive(true);
    setLastMatchTime(0); // Reset cooldown to prevent immediate match
    
    setMessage('▶️ Game Resumed! Continue matching expressions and gestures!');
    setTimeout(() => setMessage(''), 2500);
    console.log('▶️ Game resumed from target:', targetExpression);
  };

  return (
    <div className={`App game-bg${showAnimation ? ' correct-bg' : ''}`}> 
      <div className="container">
        <h1 className="game-title">Face Expression Game</h1>
        <div className="score-row">
          <span className="score-label">Score:</span> <span className="score-value">{score}</span>
          <span className="progress-label" style={{marginLeft: '20px', fontSize: '1rem', color: '#ffd700'}}>
            Progress: {gameProgress}/{gameSequence.length}
          </span>
          <span className="game-status" style={{marginLeft: '15px', fontSize: '0.9rem', color: gameActive ? '#4ade80' : (gameStarted ? '#ffa500' : '#ff6b6b')}}>
            {!gameStarted ? '⚪ Not Started' : (gameActive ? '🎮 Playing' : '⏸️ Paused')}
          </span>
          {isProcessingMatch && (
            <span style={{marginLeft: '15px', fontSize: '0.9rem', color: '#ff6b6b'}}>
              🔄 Processing...
            </span>
          )}
        </div>
        
        <div className="video-section">
          {webcamOn && <Webcam ref={webcamRef} className="game-video" />}
        </div>
        
        <div className="expression-row">
          <div className="target-exp">
            <span>Target ({gameProgress}/{gameSequence.length}):</span> 
            <span className="emoji">{!gameStarted ? '⚪' : (gameActive ? allEmojis[targetExpression] : '⏸️')}</span> 
            <b>{!gameStarted ? 'Not Started' : (gameActive ? targetExpression : 'Game Paused')}</b>
          </div>
          <div className="user-exp">
            <span>Your Expression:</span> 
            <span className={`emoji ${(!userExpression && !userGesture) ? 'none' : ''}`}>
              {!gameStarted ? '⚪' :
               !gameActive ? '⏸️' : 
               gestures.includes(targetExpression) ? 
                (userGesture ? gestureEmojis[userGesture] : '🤚') : 
                (!userExpression ? '❓' : allEmojis[userExpression])
              }
            </span> 
            <b>{!gameStarted ? 'Click Start Game' :
                !gameActive ? 'Game Paused' :
              gestures.includes(targetExpression) ? 
              (userGesture || 'None') : 
              (userExpression || 'None')
            }</b>
          </div>
        </div>
        
        <div className="button-row">
          <button className="toggle-btn" onClick={() => {
            setWebcamOn((on) => {
              if (on) {
                setUserExpression('');
              }
              return !on;
            });
          }}>
            {webcamOn ? '📹 OFF' : '📷 ON'}
          </button>
          
          {gameStarted && gameActive && (
            <button className="stop-btn" onClick={stopGame} 
                    style={{backgroundColor: '#ff6b6b', color: 'white'}}>
              ⏸️ Stop
            </button>
          )}
          
          {gameStarted && !gameActive && currentTargetIndex > 0 && (
            <button className="resume-btn" onClick={resumeGame}
                    style={{backgroundColor: '#4ade80', color: 'white'}}>
              ▶️ Resume
            </button>
          )}
          
          <button className="change-btn" onClick={() => {
            if (!gameActive) {
              setMessage('⚠️ Please start the game first!');
              setTimeout(() => setMessage(''), 1500);
              return;
            }
            
            if (isProcessingMatch) {
              setMessage('⏱️ Please wait, processing previous match...');
              setTimeout(() => setMessage(''), 1500);
              return;
            }
            
            console.log('⏭️ Manual skip to next target');
            // Skip to next target in sequence
            const nextIndex = currentTargetIndex + 1;
            if (nextIndex >= gameSequence.length) {
              // Start new game sequence
              const newSequence = generateGameSequence();
              setGameSequence(newSequence);
              setCurrentTargetIndex(0);
              setTargetExpression(newSequence[0]);
              setGameProgress(1);
              setMessage('🎮 New game sequence started!');
              console.log('🎮 Manual new game:', newSequence);
            } else {
              // Move to next in current sequence
              setCurrentTargetIndex(nextIndex);
              setTargetExpression(gameSequence[nextIndex]);
              setGameProgress(nextIndex + 1);
              setMessage(`Skipped to next target (${nextIndex + 1}/${gameSequence.length})`);
              console.log('⏭️ Manual skip to:', gameSequence[nextIndex]);
            }
            setTimeout(() => setMessage(''), 2000);
          }} disabled={!modelsLoaded || !webcamOn || !gameActive}>
            Next Target
          </button>
          
          <button className="reset-btn" onClick={startNewGame}>
            {gameStarted ? 'New Game' : 'Start Game'}
          </button>
          {/* <button className="test-btn" onClick={() => {
            setTargetExpression('korean_heart');
            setMessage('Test: korean_heart expression set manually!');
            setTimeout(() => setMessage(''), 2000);
          }} style={{backgroundColor: '#FF6B6B', color: 'white'}}>
            Test korean_heart
          </button> */}
        </div>
        
        <div className="message-row">
          <p>{message || (!gameStarted ? '🎮 Click "Start Game" to begin!' : 
                         (!gameActive ? `⏸️ Game paused at target ${gameProgress}/${gameSequence.length}. Click "Resume" to continue.` : ''))}</p>
          {!modelsLoaded && <div>Loading face recognition models...</div>}
          {gameActive && gestures.includes(targetExpression) && (
            <div style={{ fontSize: '0.9rem', color: '#ffd700', marginTop: '8px' }}>
              Hand Detection: {gestureDetectionActive ? '✅ Active' : '❌ Inactive'}
              {gestureDetectionActive && userGesture && (
                <span> | Detected: {userGesture}</span>
              )}
            </div>
          )}
        </div>
      </div>
      {/* {showAnimation && <div className="confetti-animation"></div>} */}
    </div>
  );
}

export default App;
