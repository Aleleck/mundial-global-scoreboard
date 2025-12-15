'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Award, Volume2, VolumeX, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- CONFIGURACIÓN DE SONIDO ---
const SCORE_SFX = "https://assets.mixkit.co/active_storage/sfx/1934/1934-preview.mp3"; 

const TEAM_CRESTS: Record<string, string> = {
  'Brazil': '/crests/brazil.png',
  'Colombia': '/crests/colombia.png',
  'Haiti': '/crests/haiti.png',
};

const TEAM_MESA: Record<string, string> = {
  'Colombia': 'MESA 1',
  'Brazil': 'MESA 2',
  'Haiti': 'MESA 3',
};

interface Team {
  name: string;
  score: number;
  previousRank?: number;
  rewardText?: string;
  rewardValue: number;
}

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzmKE9Mm5w0mOi4w4fvx4XdfonKhFSNfkjGhIoyvIpw3ZmprCCFm9bD5w6O4m1sMvYb/exec";
const REFRESH_INTERVAL = 2000;

const TieBadge = () => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    className="absolute -top-4 -right-2 z-50"
  >
    <motion.div
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, 5, -5, 0],
      }}
      transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1 }}
      className="bg-red-600 border-2 border-white text-white font-display text-xs font-bold px-3 py-1 rounded-full shadow-xl uppercase tracking-wider"
    >
      ¡Empate!
    </motion.div>
  </motion.div>
);

const getRankConfig = (rank: number) => {
  switch (rank) {
    case 1:
      return {
        podiumHeight: 'h-48 lg:h-64',
        textColor: 'text-amber-950',
        bgGradient: 'from-yellow-300 via-amber-400 to-yellow-500',
        numberColor: 'text-yellow-700',
        scale: 1.15,
      };
    case 2:
      return {
        podiumHeight: 'h-36 lg:h-48',
        textColor: 'text-slate-800',
        bgGradient: 'from-slate-200 via-slate-300 to-slate-400',
        numberColor: 'text-slate-500',
        scale: 1,
      };
    case 3:
      return {
        podiumHeight: 'h-28 lg:h-40',
        textColor: 'text-orange-900',
        bgGradient: 'from-orange-300 via-orange-400 to-orange-500',
        numberColor: 'text-orange-700',
        scale: 1,
      };
    default: return { podiumHeight: 'h-24', textColor: 'text-gray-500', bgGradient: 'bg-gray-200', numberColor: 'text-gray-400', scale: 1 };
  }
};

// Función mejorada para crear monedas de oro animadas
const fireGoldCoins = () => {
  const duration = 10000; // 10 segundos
  const end = Date.now() + duration;
  const coinColors = ['#FFD700', '#FFA500', '#FF8C00', '#FF6347'];
  
  // Función para crear una moneda
  const createCoin = (angle: number, velocity: number) => {
    const particleCount = 3;
    const spread = 15;
    const origin = angle < 90 ? { x: 0, y: 0.7 } : { x: 1, y: 0.7 };
    
    confetti({
      particleCount,
      angle,
      spread,
      origin,
      colors: coinColors,
      shapes: ['circle'],
      gravity: 0.8,
      scalar: 1.5,
      drift: angle < 90 ? 2 : -2,
      velocity
    });
  };

  // Animación continua de monedas durante 10 segundos
  (function frame() {
    const remaining = end - Date.now();
    const progress = 1 - (remaining / duration);
    
    // Crear oleadas de monedas
    if (progress < 0.3) {
      // Primera oleada: explosión inicial
      createCoin(60, 80);
      createCoin(120, 80);
    } else if (progress < 0.6) {
      // Segunda oleada: lluvia de monedas
      createCoin(90, 60);
      createCoin(75, 70);
      createCoin(105, 70);
    } else if (progress < 0.9) {
      // Tercera oleada: monedas dispersas
      createCoin(45, 50);
      createCoin(135, 50);
      createCoin(90, 40);
    } else {
      // Final: última ráfaga
      createCoin(60, 90);
      createCoin(120, 90);
    }
    
    if (Date.now() < end) {
      setTimeout(frame, 200); // Controlar la frecuencia de las monedas
    }
  })();
};

// Componente de moneda flotante
const FloatingCoin = ({ delay, duration }: { delay: number; duration: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0, rotate: 0 }}
    animate={{
      opacity: [0, 1, 1, 0],
      scale: [0, 1, 1, 0],
      rotate: [0, 360, 720, 1080],
      y: [0, -100, -200, -300],
      x: [0, 20, -20, 0]
    }}
    transition={{
      duration,
      delay,
      ease: "easeInOut"
    }}
    className="absolute text-yellow-400 z-50"
    style={{
      filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.8))'
    }}
  >
    <Coins className="w-8 h-8" fill="#FFD700" />
  </motion.div>
);

export const Scoreboard = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changedScores, setChangedScores] = useState<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(true);
  const [celebratingTeam, setCelebratingTeam] = useState<string | null>(null);
  
  const previousFirstPlace = useRef<string | null>(null);
  const currentTeamsRef = useRef<Team[]>([]); 
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inicializar el audio
  useEffect(() => {
    audioRef.current = new Audio(SCORE_SFX);
    audioRef.current.volume = 0.5;
  }, []);

  // Función para reproducir sonido
  const playScoreSound = useCallback(() => {
    if (!isMuted && audioRef.current) {
      audioRef.current.currentTime = 0; 
      audioRef.current.play().catch(e => console.log("Audio bloqueado por navegador:", e));
    }
  }, [isMuted]);

  const fetchData = useCallback(async () => {
    if (APPS_SCRIPT_URL.includes("AQUI_TU_URL")) { 
      setError("Config error"); 
      setLoading(false); 
      return; 
    }

    try {
      const response = await fetch(APPS_SCRIPT_URL);
      const data = await response.json();
      
      if (Array.isArray(data) && data.length >= 2) {
        const teamNames = data[0];
        const scores = data[1];
        const rewards = data[2] || [];

        const parsedTeams: Team[] = teamNames
          .map((name: string, index: number) => {
            const rawReward = String(rewards[index] || '').trim();
            const numericReward = parseInt(rawReward.replace(/[^0-9.-]/g, ''), 10) || 0;
            return {
              name: String(name || '').trim(),
              score: parseInt(String(scores[index] || '0').replace(/[^0-9.-]/g, ''), 10) || 0,
              rewardText: rawReward,
              rewardValue: numericReward
            };
          }).filter((team: Team) => team.name.length > 0);

        const sortedTeams = [...parsedTeams].sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.rewardValue - a.rewardValue;
        });

        const isDataIdentical = JSON.stringify(sortedTeams) === JSON.stringify(currentTeamsRef.current);
        
        if (!isDataIdentical) {
          const newChangedScores = new Set<string>();
          sortedTeams.forEach(newTeam => {
            const oldTeam = currentTeamsRef.current.find(t => t.name === newTeam.name);
            if (oldTeam && oldTeam.score !== newTeam.score) {
              newChangedScores.add(newTeam.name);
            }
          });

          const newFirstPlace = sortedTeams[0]?.name;
          if (previousFirstPlace.current && newFirstPlace && newFirstPlace !== previousFirstPlace.current) {
            fireGoldCoins();
          }

          if (newChangedScores.size > 0) {
            playScoreSound();
            setChangedScores(newChangedScores);
            setCelebratingTeam(Array.from(newChangedScores)[0]);
            
            // Iniciar celebración con monedas
            fireGoldCoins();
            
            setTimeout(() => {
              setChangedScores(new Set());
              setCelebratingTeam(null);
            }, 10000); // 10 segundos de celebración
          }
          
          currentTeamsRef.current = sortedTeams;
          setTeams(sortedTeams.map((team) => {
              const prevTeam = currentTeamsRef.current.find(t => t.name === team.name);
              const prevRank = prevTeam ? currentTeamsRef.current.indexOf(prevTeam) + 1 : undefined;
              return { ...team, previousRank: prevRank };
          }));
        }
      }
      setLoading(false);
    } catch (err) { 
      console.error(err); 
      setLoading(false); 
    }
  }, [playScoreSound]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return (
    <div className="min-h-screen scoreboard-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const podiumOrder = [1, 0, 2].map(i => teams[i]).filter(Boolean);
  const tiedScores = new Set<string>();
  teams.forEach(t => {
    const key = `${t.score}-${t.rewardValue}`;
    if (teams.filter(x => `${x.score}-${x.rewardValue}` === key).length > 1) tiedScores.add(t.name);
  });

  return (
    <div className="min-h-screen scoreboard-bg flex flex-col p-4 lg:p-8 overflow-hidden relative">
      <div className="stars" /> 
      <div className="stars-2" />
      <div className="embers" />
      <div className="searchlight-container">
        <div className="searchlight beam-1" />
        <div className="searchlight beam-2" />
        <div className="searchlight beam-3" />
      </div>

      {/* Botón de control de volumen */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/20 text-white transition-all shadow-lg group"
          title={isMuted ? "Activar sonido" : "Silenciar"}
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6 text-yellow-400" />}
        </button>
      </div>

      <header className="text-center mb-16 lg:mb-24 relative z-10">
        <h1 className="font-display text-5xl lg:text-8xl text-white tracking-widest text-glow-gold drop-shadow-2xl uppercase">
          Mundial Global
        </h1>
      </header>

      <div className="flex-1 flex items-end justify-center pb-4 relative z-10">
        <div className="flex items-end justify-center gap-3 lg:gap-6 w-full max-w-6xl">
          <AnimatePresence mode="popLayout">
            {podiumOrder.map((team, displayIndex) => {
              const rankByScore = teams.findIndex(t => t.score === team.score && t.rewardValue === team.rewardValue) + 1;
              const config = getRankConfig(rankByScore);
              const isFirstPlace = rankByScore === 1;
              const isTied = tiedScores.has(team.name);
              const hasScoreChanged = changedScores.has(team.name);
              const isCelebrating = celebratingTeam === team.name;
              
              let positionOrder = 'order-1';
              if (displayIndex === 1) positionOrder = 'order-2';
              if (displayIndex === 2) positionOrder = 'order-3';

              return (
                <motion.div
                  key={team.name}
                  layout
                  initial={{ opacity: 0, y: 200 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: isCelebrating ? [config.scale, config.scale * 1.3, config.scale] : config.scale,
                    rotate: isCelebrating ? [0, 5, -5, 0] : 0,
                  }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 180, 
                    damping: 20,
                    rotate: {
                      duration: 2,
                      repeat: isCelebrating ? 5 : 0,
                      repeatType: "reverse"
                    },
                    scale: {
                      duration: 0.5,
                      repeat: isCelebrating ? 20 : 0,
                      repeatType: "reverse"
                    }
                  }}
                  className={`flex-1 flex flex-col items-center mx-2 lg:mx-4 max-w-[280px] w-full ${positionOrder}`}
                  style={{ zIndex: isFirstPlace ? 20 : 10 }}
                >
                  {/* Monedas flotantes adicionales durante celebración */}
                  {isCelebrating && (
                    <>
                      <FloatingCoin delay={0} duration={3} />
                      <FloatingCoin delay={0.5} duration={3} />
                      <FloatingCoin delay={1} duration={3} />
                      <FloatingCoin delay={1.5} duration={3} />
                      <FloatingCoin delay={2} duration={3} />
                    </>
                  )}

                  <motion.div 
                    className={`
                      relative w-full rounded-3xl pt-12 pb-6 px-4 text-center shadow-2xl
                      bg-gradient-to-b ${config.bgGradient}
                      ${isFirstPlace ? 'neon-gold' : ''} 
                      ${hasScoreChanged ? 'animate-score-update' : ''}
                      ${isCelebrating ? 'celebration-pulse' : ''}
                    `}
                    animate={isCelebrating ? {
                      boxShadow: [
                        "0 0 20px rgba(255, 215, 0, 0.5)",
                        "0 0 40px rgba(255, 215, 0, 0.8)",
                        "0 0 60px rgba(255, 215, 0, 1)",
                        "0 0 40px rgba(255, 215, 0, 0.8)",
                        "0 0 20px rgba(255, 215, 0, 0.5)"
                      ]
                    } : {}}
                    transition={{ duration: 2, repeat: isCelebrating ? 5 : 0 }}
                  >
                    {isTied && <TieBadge />}
                    
                    <div className="-mt-20 lg:-mt-24 mb-3 flex justify-center relative z-20">
                      <motion.div 
                        animate={isCelebrating ? {
                          y: [0, -30, 0],
                          rotate: [0, 360, 720],
                          scale: [1, 1.2, 1]
                        } : isFirstPlace ? { y: [0, -10, 0] } : {}}
                        transition={{ 
                          duration: isCelebrating ? 2 : 4, 
                          repeat: isCelebrating ? 5 : Infinity, 
                          ease: "easeInOut",
                          rotate: { duration: 1, repeat: isCelebrating ? 10 : 0 }
                        }}
                        className="bg-white/10 backdrop-blur-md rounded-full p-2 shadow-lg border border-white/20"
                      >
                         <img src={TEAM_CRESTS[team.name]} alt={team.name} 
                              className="w-24 h-24 lg:w-32 lg:h-32 object-contain drop-shadow-2xl"/>
                      </motion.div>
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <div className="bg-black/10 px-3 py-1 rounded-full border border-black/5 mb-1">
                        <motion.span 
                          animate={isCelebrating ? {
                            scale: [1, 1.5, 1],
                            color: ['#000', '#FFD700', '#000']
                          } : {}}
                          transition={{ duration: 1, repeat: isCelebrating ? 10 : 0 }}
                          className={`font-display text-lg lg:text-xl font-bold ${config.textColor}`}
                        >
                           {team.rewardText || '$0'}
                        </motion.span>
                      </div>

                      <motion.h2 
                        animate={isCelebrating ? {
                          scale: [1, 1.3, 1],
                          textShadow: [
                            "2px 2px 4px rgba(0,0,0,0.5)",
                            "4px 4px 8px rgba(255,215,0,0.8)",
                            "2px 2px 4px rgba(0,0,0,0.5)"
                          ]
                        } : {}}
                        transition={{ duration: 1.5, repeat: isCelebrating ? 7 : 0 }}
                        className={`font-display text-2xl lg:text-4xl tracking-wide ${config.textColor} font-black uppercase leading-none mb-1`}
                      >
                        {team.name}
                      </motion.h2>
                      
                      <p className="text-xs text-gray-600 font-bold tracking-widest uppercase opacity-70 mb-4">
                        {TEAM_MESA[team.name] || 'MESA ?'}
                      </p>

                      <div className="w-full bg-black/20 backdrop-blur-sm rounded-xl py-2 border border-white/10 shadow-inner">
                        <motion.p 
                          key={team.score}
                          animate={hasScoreChanged || isCelebrating ? { 
                            scale: [1, 2, 1.5, 1],
                            color: ['#ffffff', '#FFD700', '#FFA500', '#ffffff'],
                            rotate: [0, 10, -10, 0]
                          } : {}}
                          transition={{ 
                            duration: isCelebrating ? 2 : 0.8,
                            repeat: isCelebrating ? 5 : 0
                          }}
                          className={`font-display text-6xl lg:text-7xl text-white font-black drop-shadow-lg`}
                        >
                          {team.score}
                        </motion.p>
                        <motion.p 
                          animate={isCelebrating ? {
                            scale: [1, 1.2, 1],
                            color: ['#ffffff', '#FFD700', '#ffffff']
                          } : {}}
                          transition={{ duration: 1, repeat: isCelebrating ? 10 : 0 }}
                          className="text-white/60 text-xs font-bold uppercase tracking-widest mt-[-5px]"
                        >
                          {isCelebrating ? '¡GOLAZO!' : 'Goles'}
                        </motion.p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div 
                    className={`w-[95%] -mt-6 pt-8 rounded-b-3xl bg-gradient-to-b ${config.bgGradient} relative overflow-hidden z-[-1] opacity-90 ${config.podiumHeight} shadow-2xl`}
                    animate={isCelebrating ? {
                      y: [0, -10, 0],
                      opacity: [0.9, 1, 0.9]
                    } : {}}
                    transition={{ duration: 1, repeat: isCelebrating ? 10 : 0 }}
                  >
                    <div className="absolute inset-0 flex items-end justify-center pb-4">
                      <motion.span 
                        animate={isCelebrating ? {
                          scale: [1, 1.5, 1],
                          opacity: [0.3, 0.8, 0.3]
                        } : {}}
                        transition={{ duration: 1.5, repeat: isCelebrating ? 7 : 0 }}
                        className={`font-display text-8xl lg:text-9xl ${config.numberColor} opacity-30 mix-blend-multiply`}
                      >
                        {rankByScore}
                      </motion.span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-50" />
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <style jsx>{`
        .scoreboard-bg {
          background: radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1e 50%, #000000 100%);
          position: relative;
          overflow: hidden;
        }

        .stars, .stars-2 {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .stars {
          background-image: 
            radial-gradient(2px 2px at 20px 30px, #eee, transparent),
            radial-gradient(2px 2px at 40px 70px, #ddd, transparent),
            radial-gradient(1px 1px at 50px 50px, #fff, transparent),
            radial-gradient(1px 1px at 80px 10px, #fff, transparent),
            radial-gradient(2px 2px at 130px 80px, #eee, transparent);
          background-repeat: repeat;
          background-size: 200px 200px;
          animation: zoom 10s infinite;
          opacity: 0.5;
        }

        .stars-2 {
          background-image: 
            radial-gradient(1px 1px at 10px 10px, #fff, transparent),
            radial-gradient(1px 1px at 150px 150px, #ddd, transparent),
            radial-gradient(2px 2px at 60px 170px, #eee, transparent);
          background-repeat: repeat;
          background-size: 300px 300px;
          animation: zoom 15s infinite;
          opacity: 0.3;
        }

        .embers {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          background-image: radial-gradient(2px 2px at 20% 30%, #FFD700, transparent),
                           radial-gradient(2px 2px at 60% 70%, #FFA500, transparent),
                           radial-gradient(1px 1px at 50% 50%, #FF8C00, transparent);
          background-size: 100px 100px;
          animation: float 20s infinite linear;
          opacity: 0.6;
        }

        .searchlight-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .searchlight {
          position: absolute;
          width: 150%;
          height: 100px;
          background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.1), transparent);
          transform-origin: center;
        }

        .beam-1 {
          top: 10%;
          animation: sweep 8s infinite linear;
        }

        .beam-2 {
          top: 40%;
          animation: sweep 10s infinite linear reverse;
          animation-delay: -2s;
        }

        .beam-3 {
          top: 70%;
          animation: sweep 12s infinite linear;
          animation-delay: -4s;
        }

        @keyframes zoom {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }

        @keyframes float {
          0% { transform: translateY(100vh) rotate(0deg); }
          100% { transform: translateY(-100vh) rotate(360deg); }
        }

        @keyframes sweep {
          0% { transform: translateX(-100%) rotate(-30deg); }
          100% { transform: translateX(100%) rotate(-30deg); }
        }

        .text-glow-gold {
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.8),
                       0 0 20px rgba(255, 215, 0, 0.6),
                       0 0 30px rgba(255, 215, 0, 0.4);
        }

        .neon-gold {
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.6),
                      0 0 40px rgba(255, 215, 0, 0.4),
                      0 0 60px rgba(255, 215, 0, 0.2);
          animation: neon-pulse 2s infinite alternate;
        }

        @keyframes neon-pulse {
          from { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.4); }
          to { box-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.6); }
        }

        .animate-score-update {
          animation: score-flash 0.6s ease-out;
        }

        @keyframes score-flash {
          0% { background-color: transparent; }
          50% { background-color: rgba(255, 215, 0, 0.3); }
          100% { background-color: transparent; }
        }

        .celebration-pulse {
          animation: celebration-glow 1s infinite alternate;
        }

        @keyframes celebration-glow {
          from { 
            transform: scale(1);
            filter: brightness(1);
          }
          to { 
            transform: scale(1.02);
            filter: brightness(1.2);
          }
        }

        .font-display {
          font-family: 'Impact', 'Arial Black', sans-serif;
        }
      `}</style>
    </div>
  );
};

export default Scoreboard;