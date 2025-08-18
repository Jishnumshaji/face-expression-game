import React, { useState } from 'react';

const GestureGuide = () => {
  const [isVisible, setIsVisible] = useState(false);

  const gestures = [
    {
      name: 'Thumbs Up',
      emoji: '👍',
      description: 'Make a fist and extend your thumb upward',
      tips: 'Keep other fingers closed, thumb pointing up'
    },
    {
      name: 'Thumbs Down', 
      emoji: '👎',
      description: 'Make a fist and extend your thumb downward',
      tips: 'Keep other fingers closed, thumb pointing down'
    },
    {
      name: 'Love Sign',
      emoji: '🤟',
      description: 'Extend thumb, index finger, and pinky (I Love You in ASL)',
      tips: 'Keep middle and ring fingers folded down'
    },
    {
      name: 'Peace Sign',
      emoji: '✌️', 
      description: 'Extend index and middle fingers in a V shape',
      tips: 'Keep ring and pinky fingers folded, make a clear V'
    },
    {
      name: 'Korean Heart',
      emoji: '🤏',
      description: 'Touch thumb tip and index finger tip to form a small heart',
      tips: 'Make a tiny heart shape with thumb and index finger'
    },
    {
      name: 'Two-Hand Heart',
      emoji: '💖',
      description: 'Use both hands to form a heart shape above your head',
      tips: 'Bring both hands together, thumbs touching at top, fingers forming heart'
    }
  ];

  return (
    <div className="gesture-guide-container">
      <button 
        className="guide-toggle-btn"
        onClick={() => setIsVisible(!isVisible)}
      >
        {isVisible ? 'Hide' : 'Show'} Gesture Guide
      </button>
      
      {isVisible && (
        <div className="gesture-guide-modal">
          <div className="guide-content">
            <div className="guide-header">
              <h3>Hand Gesture Recognition Guide</h3>
              <button 
                className="close-btn"
                onClick={() => setIsVisible(false)}
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>
            <div className="gesture-cards">
              {gestures.map((gesture, index) => (
                <div key={index} className="gesture-card">
                  <div className="gesture-emoji">{gesture.emoji}</div>
                  <h4>{gesture.name}</h4>
                  <p className="gesture-description">{gesture.description}</p>
                  <p className="gesture-tips">💡 {gesture.tips}</p>
                </div>
              ))}
            </div>
            <div className="guide-footer">
              <p><strong>Tips for best results:</strong></p>
              <ul>
                <li>Hold gestures clearly for 1-2 seconds</li>
                <li>Keep your hand(s) visible to the camera</li>
                <li>Make sure gestures are well-lit</li>
                <li>For two-handed gestures, use both hands simultaneously</li>
                <li>Korean heart: Make a small precise heart with thumb and index finger</li>
                <li>Two-hand heart: Position hands close together to form heart shape</li>
                <li>Try different distances from camera if detection fails</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestureGuide;
