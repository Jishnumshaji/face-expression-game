import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import './App.css';

const expressions = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'disgusted',
  'fearful',
];

const allTargets = [...expressions];

const expressionEmojis = {
  'neutral': '😐',
  'happy': '😄',
  'sad': '😢',
  'angry': '😠',
  'surprised': '😲',
  'disgusted': '🤢',
  'fearful': '😨',
};

const allEmojis = { ...expressionEmojis };

function getRandomTarget() {
  return allTargets[Math.floor(Math.random() * allTargets.length)];
}

function App() {
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [targetExpression, setTargetExpression] = useState(getRandomTarget());
  const [userExpression, setUserExpression] = useState('');
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [webcamOn, setWebcamOn] = useState(true);
  const [showAnimation, setShowAnimation] = useState(true);
  const [lastMatchTime, setLastMatchTime] = useState(0);

  const checkForMatch = (detected) => {
    const currentTime = Date.now();
    
    if (detected === targetExpression && currentTime - lastMatchTime > 2000) {
      setScore(prevScore => prevScore + 1);
      setMessage('🎉 Correct! +1 Point');
      setShowAnimation(true);
      setLastMatchTime(currentTime);
      
      // Generate new target after a brief delay
      setTimeout(() => {
        setTargetExpression(getRandomTarget());
        setMessage('');
        setShowAnimation(false);
      }, 1500);
    }
  };

  useEffect(() => {
    // Test animation for 2 seconds
    const timer = setTimeout(() => setShowAnimation(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      setModelsLoaded(true);
    };
    loadModels();
  }, []);

  useEffect(() => {
    let interval;
    if (modelsLoaded && webcamOn) {
      interval = setInterval(async () => {
        if (webcamRef.current && webcamRef.current.video.readyState === 4) {
          const detections = await faceapi.detectSingleFace(webcamRef.current.video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
          if (detections && detections.expressions) {
            const sorted = Object.entries(detections.expressions).sort((a, b) => b[1] - a[1]);
            const currentExpression = sorted[0][0];
            setUserExpression(currentExpression);
            checkForMatch(currentExpression);
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [modelsLoaded, webcamOn, targetExpression, lastMatchTime]);

  const checkExpression = () => {
    if (userExpression === targetExpression) {
      setScore(score + 1);
      setMessage('Correct!');
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 1200);
    } else {
      const currentDisplay = userExpression || 'None';
      setMessage(`Try again! You showed: ${currentDisplay}`);
      setShowAnimation(false);
    }
  };

  const resetScore = () => {
    setScore(0);
    setMessage('Score reset!');
    setLastMatchTime(0);
    setTimeout(() => setMessage(''), 2000);
  };

  return (
    <div className={`App game-bg${showAnimation ? ' correct-bg' : ''}`}> 
      <h1 className="game-title">Face Expression Game</h1>
      <div className="score-row">
        <span className="score-label">Score:</span> <span className="score-value">{score}</span>
      </div>
      
      <div className="video-section">
        {webcamOn && <Webcam ref={webcamRef} width={480} height={360} className="game-video" />}
      </div>
      
      <div className="expression-row">
        <div className="target-exp">
          <span>Target:</span> 
          <span className="emoji">{allEmojis[targetExpression]}</span> 
          <b>{targetExpression}</b>
        </div>
        <div className="user-exp">
          <span>Your Expression:</span> 
          <span className={`emoji ${!userExpression ? 'none' : ''}`}>
            {!userExpression ? '❓' : allEmojis[userExpression]}
          </span> 
          <b>{userExpression || 'None'}</b>
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
          {webcamOn ? 'Turn Webcam Off' : 'Turn Webcam On'}
        </button>
        <button className="check-btn" onClick={checkExpression} disabled={!modelsLoaded || !webcamOn}>
          Check
        </button>
        <button className="change-btn" onClick={() => setTargetExpression(getRandomTarget())} disabled={!modelsLoaded || !webcamOn}>
          Change Target
        </button>
        <button className="reset-btn" onClick={resetScore}>
          Reset Score
        </button>
      </div>
      
      <div className="message-row">
        <p>{message}</p>
        {!modelsLoaded && <div>Loading face recognition models...</div>}
      </div>
      {/* {showAnimation && <div className="confetti-animation"></div>} */}
    </div>
  );
}

export default App;
