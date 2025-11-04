import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- CONFIGURATION ---
// Set the default exam duration to 180 minutes (3 hours)
const DEFAULT_DURATION_MINUTES = 180;
const TOTAL_DURATION_SECONDS = DEFAULT_DURATION_MINUTES * 60;
const WARNING_THRESHOLD_SECONDS = 15 * 60; // 15 minutes remaining
const INITIAL_RESTRICTION_SECONDS = 45 * 60; // 45 minutes elapsed

// NEW: Hard stop the extra time counter at 30 minutes (negative 1800 seconds)
const EXTRA_TIME_LIMIT_SECONDS = -30 * 60; 

// Placeholder for the University of Auckland brand color
const BRAND_COLOR = '#00529b'; // Dark Blue
const ACCENT_COLOR = '#b50e32'; // Red/Maroon

// --- UTILITY FUNCTIONS ---

// Helper to format seconds into H:MM (Used for marker labels)
const formatTimeHMM = (totalSeconds) => {
    const absSeconds = Math.abs(totalSeconds);
    // H: single digit hour (no padStart)
    const h = Math.floor(absSeconds / 3600); 
    // MM: two digit minute (padStart)
    const m = Math.floor((absSeconds % 3600) / 60);

    let timeString = `${h}:${String(m).padStart(2, '0')}`;
    
    // Add negative sign if time is negative (overrun)
    return totalSeconds < 0 ? `-${timeString}` : timeString;
};

// Helper to format seconds into H:MM:SS (Used for main countdown and overrun message)
const formatTimeHHMMSS = (totalSeconds) => {
    const absSeconds = Math.abs(totalSeconds);
    const h = Math.floor(absSeconds / 3600);
    const m = Math.floor((absSeconds % 3600) / 60);
    const s = absSeconds % 60;
    
    // H: single digit hour
    let timeString = `${String(h)}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Add negative sign if time is negative (overrun)
    return totalSeconds < 0 ? `-${timeString}` : timeString;
};

// Helper to format seconds into MM:SS (Used for extra time message)
const formatTimeMMSS = (totalSeconds) => {
    const absSeconds = Math.abs(totalSeconds);
    const m = Math.floor(absSeconds / 60);
    const s = absSeconds % 60;
    
    let timeString = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    
    // Extra time is always negative in the state, so we don't need a '-' sign
    return timeString;
};

// Helper to calculate the next half-hour (XX:00 or XX:30)
const calculateNextHalfHourTime = () => {
    const now = new Date();
    let nextStart = new Date(now.getTime());

    const currentMinutes = now.getMinutes();

    if (currentMinutes < 30) {
        // If minutes are 0-29, the next half hour is at :30
        nextStart.setMinutes(30);
    } else {
        // If minutes are 30-59, the next half hour is the next hour at :00
        nextStart.setHours(now.getHours() + 1); 
        nextStart.setMinutes(0);
    }
    
    // Always reset seconds and milliseconds
    nextStart.setSeconds(0);
    nextStart.setMilliseconds(0);
    
    return nextStart;
};


// --- Digital Clock Component ---
// This clock displays the real-world current time in 24-hour format (without seconds).
const DigitalClock = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    // Format time as HH:MM (24-hour format)
    const formattedTime = time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Enforce 24-hour format
    });

    return (
        // Renders time as a single string (Lexend font)
        <div className="absolute top-8 left-8 text-6xl sm:text-8xl font-extrabold text-white z-10">
            {formattedTime}
        </div>
    );
};


// --- Main App Component ---
const App = () => {
    // timeRemainingSeconds is the core state
    const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(TOTAL_DURATION_SECONDS);
    const [isPaused, setIsPaused] = useState(true);
    const [isFinished, setIsFinished] = useState(false);
    
    // New State for Auto-Start Feature
    const [isAutoStartEnabled, setIsAutoStartEnabled] = useState(false);
    const [autoStartTime, setAutoStartTime] = useState(null); // Stores the Date object for scheduled start
    
    // Existing State for Extra Time
    const [isExtraTimeEnabled, setIsExtraTimeEnabled] = useState(false);
    
    // Ref for the main timer loop
    const intervalRef = useRef(null);
    // Ref for the auto-start check loop
    const checkIntervalRef = useRef(null);

    // Function to handle the actual countdown logic
    const tick = useCallback(() => {
        setTimeRemainingSeconds(prevTime => {
            const newTime = prevTime - 1;
            
            // Check 1: Extra Time OFF - Hard Stop at Zero
            if (!isExtraTimeEnabled && newTime < 0) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                setIsPaused(true);
                setIsFinished(true);
                return 0; // Fix time at 0
            }

            // Check 2: Extra Time ON - Hard Stop at Limit (-30:00)
            if (isExtraTimeEnabled && newTime <= EXTRA_TIME_LIMIT_SECONDS) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                setIsPaused(true);
                setIsFinished(true);
                return EXTRA_TIME_LIMIT_SECONDS; // Fix time at limit
            }

            // Check 3: Main Finish Notification (Always happens at 0)
            if (newTime <= 0 && prevTime > 0) {
                setIsFinished(true);
            }
            
            // Allow timer to continue counting (even if negative and extra time is enabled)
            return newTime;
        });
    }, [isExtraTimeEnabled]);

    // Start/Pause Toggle (now wrapped in useCallback due to auto-start dependency)
    const toggleTimer = useCallback(() => {
        if (isPaused) {
            // Start the timer only if not already running
            if (!intervalRef.current) {
                intervalRef.current = setInterval(tick, 1000);
            }
            setIsPaused(false);
        } else {
            // Pause the timer
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setIsPaused(true);
        }
    }, [isPaused, tick]);

    // Reset Function
    const resetTimer = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        // Clear auto-start schedule on reset
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
        }
        setIsAutoStartEnabled(false);
        setAutoStartTime(null);

        setTimeRemainingSeconds(TOTAL_DURATION_SECONDS);
        setIsPaused(true);
        setIsFinished(false);
    };
    
    // --- Auto-Start Logic ---
    useEffect(() => {
        // Clear interval and schedule if feature is off, timer is running, or exam is finished
        if (!isAutoStartEnabled || !isPaused || isFinished) {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
            }
            setAutoStartTime(null);
            return;
        }

        // If enabled and paused, calculate the target time only once
        if (!autoStartTime) {
            setAutoStartTime(calculateNextHalfHourTime());
            return;
        }

        // Start a fast interval to check against real-time
        if (!checkIntervalRef.current) {
            checkIntervalRef.current = setInterval(() => {
                const now = new Date();
                
                // If current time is greater than or equal to the scheduled auto-start time
                if (now.getTime() >= autoStartTime.getTime()) {
                    // 1. Clear the check interval
                    clearInterval(checkIntervalRef.current);
                    checkIntervalRef.current = null;
                    
                    // 2. Stop auto-start feature once triggered
                    setIsAutoStartEnabled(false); 

                    // 3. Trigger the main timer start
                    if (isPaused && !intervalRef.current) {
                        toggleTimer(); // Starts the main timer and sets isPaused=false
                    }
                }
            }, 500); // Check every half second
        }

        // Cleanup function for this effect
        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
            }
        };
    }, [isAutoStartEnabled, isPaused, isFinished, autoStartTime, toggleTimer]);


    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, []);

    // Progress Calculation
    const timeElapsedSeconds = TOTAL_DURATION_SECONDS - timeRemainingSeconds;
    // Cap progress at 100% (when remaining time hits 0)
    const progressPercent = Math.min(100, (timeElapsedSeconds / TOTAL_DURATION_SECONDS) * 100);

    // Dynamic states
    const isWarning = timeRemainingSeconds > 0 && timeRemainingSeconds <= WARNING_THRESHOLD_SECONDS;
    const isRestricted = timeElapsedSeconds > 0 && timeElapsedSeconds <= INITIAL_RESTRICTION_SECONDS; 
    
    // Dynamic styles
    // Countdown timer color logic remains the same (red/gray)
    const digitalColor = isFinished ? 'text-gray-500' : 'text-red-400';
    
    // Determine if the manual Start button should be disabled
    const isStartButtonDisabled = isAutoStartEnabled;
    
    // --- Vertical Timeline Label Rendering Function ---
    const renderVerticalTimelineLabels = () => {
        const labels = [];
        const intervalMins = 15; // 15-minute markers as requested
        
        for (let min = 0; min <= DEFAULT_DURATION_MINUTES; min += intervalMins) {
            const percent = (min / DEFAULT_DURATION_MINUTES) * 100;
            const timeSeconds = min * 60;
            
            // Use the H:MM format helper
            const timeLabel = formatTimeHMM(timeSeconds).replace('-', ''); // No negative sign for timeline markers

            // All 15-minute markers are treated as major labels
            const isMajorLabel = true; 

            labels.push({ 
                // UPDATED: Check for 'Start' (min === 0) first, then 'Finish', then the formatted time
                time: min === 0 ? 'Start' : (min === DEFAULT_DURATION_MINUTES ? 'Finish' : timeLabel), 
                percent, 
                isMajorLabel,
                markerTimeSeconds: timeSeconds // Store marker time in seconds
            });
        }
        
        return labels.map((label, index) => {
            const topPosition = label.percent;
            
            // Check if the marker time has been passed/consumed
            let isPassed = label.markerTimeSeconds <= timeElapsedSeconds;
            
            // FIX: The 0:00 marker should only be marked as passed if timeElapsedSeconds > 0.
            // Also apply this logic if the label is 'Start'
            if (label.markerTimeSeconds === 0) {
                isPassed = timeElapsedSeconds > 0;
            }
            
            // Passed marker remains green-400. Unpassed marker is now pure white.
            const labelClasses = `text-3xl font-medium whitespace-nowrap block ${isPassed ? 'text-green-400' : 'text-white'}`;
            const dotColor = isPassed ? 'bg-green-500' : 'bg-white'; // Dot color defined for dot rendering
            
            return (
                <div 
                    key={index}
                    // Absolute positioning within the container
                    className="absolute w-full flex items-center justify-end"
                    // Corrected the closing quote for the transform style value from a backtick to a single quote.
                    style={{ top: `${topPosition}%`, transform: 'translateY(-50%)' }} 
                >
                    {/* Text Label (H2 formatted style - now text-3xl) */}
                    <span 
                        className={`mr-4 ${labelClasses}`}
                    >
                        {/* Renders time as a simple string */}
                        {label.time}
                    </span>
                    
                    {/* Marker Indicator: Small circle/dot (REVERTED TO DOT) */}
                    <div 
                        className={`w-4 h-4 rounded-full ${dotColor}`} // Increased dot size slightly for visibility
                    ></div>
                </div>
            );
        });
    };


    return (
        // Full black background and pure white default text
        <div className="min-h-screen bg-black font-sans p-4 sm:p-8 text-white relative">
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@200;400;600;700;800&display=swap');
                body { font-family: 'Lexend', sans-serif; }
                .logo-bg {
                    background-color: ${BRAND_COLOR};
                }
                `}
            </style>

            {/* 1. TOP LEFT CLOCK */}
            <DigitalClock />

            {/* Main Content Area: Added pt-40 to push content below the absolute elements. pb-20 added for the fixed button bar */}
            <main className="flex flex-col items-center pt-40 pb-20"> 

                {/* Horizontal Flex Container for Vertical Bar and Clock/Timer */}
                <div className="flex flex-col md:flex-row items-center md:items-start justify-center w-full max-w-4xl mx-auto pt-8">

                    {/* 1. Vertical Timeline (Left Side) */}
                    <div className="w-full md:w-32 h-[600px] flex justify-center md:justify-end items-start md:mr-16 mb-8 md:mb-0">
                        {/* Timeline container: Relative for absolute positioning of labels */}
                        <div className="w-48 h-full relative"> 
                            
                            {/* Timeline Labels and Ticks */}
                            {renderVerticalTimelineLabels()}
                        </div>
                    </div>


                    {/* 2. Main Timer Content (Center) */}
                    <div className="flex-grow flex flex-col items-center mt-1"> 
                        
                        {/* Digital Countdown Timer */}
                        <div className="text-center"> 
                            <p className="text-3xl sm:text-4xl font-semibold text-white mb-2">
                                Time Remaining:
                            </p>
                            {/* Renders H:MM:SS countdown */}
                            <p className={`text-6xl sm:text-8xl font-extrabold ${digitalColor}`}>
                                {formatTimeHHMMSS(timeRemainingSeconds)}
                            </p>
                        </div>
                        
                        {/* Status/Warning Message: text-left for alignment, and font sizes matched */}
                        <div className="mt-16 w-full max-w-xl text-left p-4 rounded-lg">
                            {/* NEW: Auto-Start Scheduled Message */}
                            {isAutoStartEnabled && isPaused && autoStartTime && (
                                <p className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-4 text-center">
                                    Auto-Starting at {autoStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </p>
                            )}

                            {/* Condition 1: Extra Time ON and Hard Stop Reached */}
                            {isExtraTimeEnabled && timeRemainingSeconds <= EXTRA_TIME_LIMIT_SECONDS ? (
                                <p className="text-3xl sm:text-4xl font-bold text-red-400">
                                    Writing Time Over. Please STOP writing and remain seated.
                                </p>
                            // Condition 2: Timer has stopped (either at 0 with extra time OFF, or counting negative with extra time ON)
                            ) : isFinished && timeRemainingSeconds >= 0 ? (
                                <p className="text-3xl sm:text-4xl font-bold text-white">
                                    Writing Time Over. Please STOP writing and remain seated.
                                </p>
                            ) : isWarning ? (
                                // Final 15-minute warning (red text)
                                <p 
                                    className={`text-3xl sm:text-4xl font-medium text-red-400`}
                                    style={{ color: ACCENT_COLOR }}
                                >
                                    You may NOT leave the room in the final 15 minutes of the exam. Please remain seated and raise your hand if you need a supervisor.
                                </p>
                            ) : isRestricted ? (
                                // Initial 45-minute restriction (white text)
                                <div style={{ color: BRAND_COLOR }}>
                                    <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">
                                        You may not leave the room in the first 45 minutes of the exam.
                                    </h1>
                                    <h2 className="text-2xl sm:text-3xl font-medium text-white">
                                        Please stay in your seat. If you need a supervisor, raise your hand.
                                    </h2>
                                </div>
                            ) : (
                                // Normal in-progress message (white text)
                                <p 
                                    className="text-3xl sm:text-4xl font-medium text-white"
                                    style={{ color: BRAND_COLOR }}
                                >
                                    The exam is in progress. Check the timer frequently.
                                </p>
                            )}
                            {timeRemainingSeconds < 0 && isExtraTimeEnabled && (
                                // Extra Time Display (Only if enabled and hasn't hit the hard stop)
                                <p className="mt-4 text-3xl sm:text-4xl font-bold text-red-400"> 
                                    (Extra Time: {formatTimeMMSS(timeRemainingSeconds)})
                                </p>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            {/* 3. FIXED BOTTOM BUTTONS: Single line, centered, fixed to the bottom */}
            <div 
                className="fixed inset-x-0 bottom-0 flex justify-center items-center py-6 bg-black/90 border-t border-gray-800 z-50 space-x-12"
            >
                
                {/* Start/Pause Button */}
                <button
                    onClick={toggleTimer}
                    className={`font-semibold transition-opacity duration-200 text-white hover:opacity-100 ${isStartButtonDisabled ? 'opacity-10' : 'opacity-15'}`}
                    disabled={isStartButtonDisabled || (timeRemainingSeconds <= EXTRA_TIME_LIMIT_SECONDS && isExtraTimeEnabled)}
                >
                    {isPaused ? 'Start' : 'Pause'}
                </button>
                
                {/* Reset Button */}
                <button
                    onClick={resetTimer}
                    className="font-semibold transition-opacity duration-200 text-white hover:opacity-100"
                    style={{ opacity: 0.15 }}
                >
                    Reset
                </button>

                {/* Configuration Control: Extra Time Toggle */}
                <button
                    onClick={() => setIsExtraTimeEnabled(prev => !prev)}
                    className={`font-semibold transition-opacity duration-200 text-white hover:opacity-100`}
                    style={{ opacity: 0.15 }}
                    disabled={timeRemainingSeconds <= EXTRA_TIME_LIMIT_SECONDS && isExtraTimeEnabled}
                >
                    Extra Time: {isExtraTimeEnabled ? 'ON' : 'OFF'}
                </button>
                
                {/* NEW: Auto-Start Toggle */}
                <button
                    onClick={() => setIsAutoStartEnabled(prev => !prev)}
                    className={`font-semibold transition-opacity duration-200 text-white hover:opacity-100`}
                    style={{ opacity: isAutoStartEnabled ? 0.75 : 0.15 }}
                    disabled={!isPaused || isFinished} // Only allowed when paused and not finished
                >
                    Auto-Start: {isAutoStartEnabled ? 'ON' : 'OFF'}
                </button>
            </div>
        </div>
    );
};

export default App;
