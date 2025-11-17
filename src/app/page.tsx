'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import ChallngrLogo from '@/components/ChallngrLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { Trophy, Users, TrendingUp, Target, BarChart3, Zap, ArrowRight, CheckCircle2, Star, Flame, Award, Activity, Sparkles, TrendingDown, Medal, Crown } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

// Animated Counter Component
function AnimatedCounter({ value, suffix = '', duration = 2 }: { value: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    const increment = value / (duration * 60);
    const timer = setInterval(() => {
      countRef.current += increment;
      if (countRef.current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(countRef.current));
      }
    }, 1000 / 60);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{Math.floor(count)}{suffix}</span>;
}

// Floating Particle Component
function FloatingParticle({ delay = 0 }: { delay?: number }) {
  const x = Math.random() * 100;
  const y = Math.random() * 100;
  const duration = 10 + Math.random() * 10;

  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full bg-[#00D4FF] opacity-30"
      initial={{ x: `${x}%`, y: `${y}%`, scale: 0 }}
      animate={{
        y: [`${y}%`, `${y - 20}%`, `${y}%`],
        x: [`${x}%`, `${x + 10}%`, `${x}%`],
        scale: [0, 1, 0],
        opacity: [0, 0.5, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: "easeInOut",
      }}
    />
  );
}

// Particle Background
function ParticleBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <FloatingParticle key={i} delay={i * 0.2} />
      ))}
    </div>
  );
}

export default function Home() {
  const { loading } = useAuth();
  const heroRef = useRef<HTMLElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use window scroll for parallax effect - only after mount to avoid hydration issues
  const { scrollYProgress } = useScroll({
    layoutEffect: false
  });

  const y = useTransform(scrollYProgress, [0, 0.5], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  // Removed stats - we're a new app with no users yet

  const features = [
    {
      icon: Trophy,
      title: 'Compete & Win',
      description: 'Join weight loss competitions and climb the leaderboard to victory.',
      gradient: 'from-[#00D4FF] to-cyan-400',
    },
    {
      icon: Users,
      title: 'Team Up',
      description: 'Create teams and compete together in group challenges.',
      gradient: 'from-[#00D4FF] to-blue-400',
    },
    {
      icon: TrendingUp,
      title: 'Track Progress',
      description: 'Monitor your weight loss journey with detailed analytics and charts.',
      gradient: 'from-[#00D4FF] to-cyan-300',
    },
    {
      icon: Target,
      title: 'Set Goals',
      description: 'Define personal milestones and celebrate your achievements.',
      gradient: 'from-[#00D4FF] to-blue-300',
    },
    {
      icon: BarChart3,
      title: 'Real-time Stats',
      description: 'See live leaderboards and competition standings as they update.',
      gradient: 'from-[#00D4FF] to-cyan-500',
    },
    {
      icon: Zap,
      title: 'Stay Motivated',
      description: 'Get notifications and reminders to keep you on track.',
      gradient: 'from-[#00D4FF] to-blue-500',
    },
  ];

  const steps = [
    {
      number: '1',
      title: 'Sign Up',
      description: 'Create your account in seconds and set up your profile.',
      icon: Sparkles,
    },
    {
      number: '2',
      title: 'Join a Competition',
      description: 'Browse active competitions or create your own challenge.',
      icon: Trophy,
    },
    {
      number: '3',
      title: 'Track & Compete',
      description: 'Log your weight, track progress, and compete for the top spot.',
      icon: Activity,
    },
  ];

  // Removed testimonials and leaderboard - we're a new app launching soon

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#00D4FF] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChallngrLogo size="md" />
            </motion.div>
            <div className="flex items-center gap-4">
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-sm font-medium text-muted-foreground"
              >
                📱 Mobile App Coming Soon
              </motion.div>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        <ParticleBackground />
        
        {/* Creative geometric shapes */}
        <div className="absolute top-20 right-10 w-64 h-64 bg-[#00D4FF]/10 geometric-shape float-slow opacity-50" />
        <div className="absolute bottom-20 left-10 w-48 h-48 bg-[#00D4FF]/10 geometric-shape-reverse float-slow opacity-50" style={{ animationDelay: '2s' }} />
        
        {/* Animated gradient background */}
        <div className="absolute inset-0 -z-10">
          <motion.div
            animate={{
              opacity: [0.3, 0.5, 0.3],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-[#00D4FF]/20 blur-3xl"
          />
          <motion.div
            animate={{
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00D4FF]/30 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              opacity: [0.2, 0.4, 0.2],
              scale: [1, 1.2, 1],
              rotate: [0, -90, 0],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gray-500/30 rounded-full blur-3xl"
          />
        </div>

        <motion.div
          style={isMounted ? { y, opacity } : {}}
          className="container mx-auto max-w-6xl text-center space-y-8 relative z-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="inline-block"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4FF]/20 border border-[#00D4FF]/30 text-sm font-medium">
                <Flame className="h-4 w-4 text-[#00D4FF]" />
                <span>Join the competition revolution</span>
              </span>
            </motion.div>

            <div className="relative">
              {/* Decorative line */}
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-1 h-24 bg-gradient-to-b from-transparent via-[#00D4FF] to-transparent hidden lg:block" />
              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight relative">
                <motion.span
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="block relative"
                >
                  <span className="relative z-10 bg-gradient-to-r from-[#00D4FF] to-cyan-300 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                    Where Fitness
                  </span>
                  <span className="absolute -bottom-2 left-0 w-32 h-1 bg-gradient-to-r from-[#00D4FF] to-transparent opacity-50" />
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                  className="block mt-2 relative"
                >
                  <span className="text-foreground relative z-10">Meets Competition</span>
                  <span className="absolute -top-2 right-0 w-40 h-1 bg-gradient-to-l from-[#00D4FF] to-transparent opacity-50" />
                </motion.span>
              </h1>
              <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-1 h-24 bg-gradient-to-b from-transparent via-[#00D4FF] to-transparent hidden lg:block" />
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
            >
              Transform your fitness journey into an epic competition. Join weight loss competitions, track your progress, and compete with friends - completely free, no fees, no catch.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="pt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
            >
              {['100% Free', 'No fees ever', 'No credit card required'].map((text, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 1.4 + i * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span>{text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-muted-foreground"
          >
            <span className="text-sm">Scroll to explore</span>
            <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center p-2">
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 bg-muted-foreground rounded-full"
              />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30 relative overflow-hidden diagonal-divider">
        {/* Creative background elements */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-[#00D4FF]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-0 w-96 h-96 bg-[#00D4FF]/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4 mb-16"
          >
            <motion.span
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              className="inline-block"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00D4FF]/20 border border-[#00D4FF]/30 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-[#00D4FF]" />
                <span>Powerful Features</span>
              </span>
            </motion.span>
            <h2 className="text-4xl sm:text-5xl font-bold">Everything You Need to Succeed</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to keep you motivated and help you reach your fitness goals - all completely free, forever.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 stagger-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isOdd = index % 2 === 0;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: isOdd ? 40 : -40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1, type: "spring" }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="perspective-1000"
                >
                  <Card className="h-full hover:shadow-2xl transition-all duration-300 border-2 hover:border-[#00D4FF]/50 overflow-hidden group creative-border relative">
                    {/* Creative corner accent */}
                    <div className={`absolute top-0 ${isOdd ? 'left-0' : 'right-0'} w-20 h-20 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-20 transition-opacity`} 
                         style={{ clipPath: isOdd ? 'polygon(0 0, 100% 0, 0 100%)' : 'polygon(100% 0, 100% 100%, 0 0)' }} />
                    
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                    <CardHeader className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <motion.div
                          whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                          transition={{ duration: 0.5 }}
                          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg relative`}
                        >
                          <Icon className="h-8 w-8 text-white relative z-10" />
                          <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} blur-xl opacity-50`} />
                        </motion.div>
                        {/* Number badge */}
                        <div className="text-4xl font-bold text-muted-foreground/20">{String(index + 1).padStart(2, '0')}</div>
                      </div>
                      <CardTitle className="text-2xl font-bold">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <CardDescription className="text-base leading-relaxed text-muted-foreground">{feature.description}</CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Creative diagonal background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background" />
        <div className="absolute top-0 left-0 w-full h-full" style={{ 
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 212, 255, 0.03) 10px, rgba(0, 212, 255, 0.03) 20px)'
        }} />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get started in three simple steps and begin your fitness journey today.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Creative connecting line with dots */}
            <div className="hidden md:flex absolute top-24 left-1/4 right-1/4 items-center justify-between transform -translate-y-1/2">
              <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-[#00D4FF] to-transparent" />
              <div className="w-3 h-3 rounded-full bg-[#00D4FF] mx-4" />
              <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-[#00D4FF] to-transparent" />
              <div className="w-3 h-3 rounded-full bg-[#00D4FF] mx-4" />
              <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-[#00D4FF] to-transparent" />
            </div>
            
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 50, scale: 0.8 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.2, type: "spring" }}
                  whileHover={{ y: -10 }}
                  className="relative text-center space-y-6"
                >
                  {/* Creative number background */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-8xl font-black text-[#00D4FF]/5 select-none">
                    {step.number}
                  </div>
                  
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    className="relative inline-block"
                  >
                    <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-[#00D4FF] to-cyan-400 flex items-center justify-center text-4xl font-bold text-white mx-auto shadow-xl shadow-[#00D4FF]/30 relative z-10 transform rotate-3 hover:rotate-0 transition-transform">
                      <Icon className="h-12 w-12" />
                    </div>
                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#00D4FF] to-cyan-400 blur-2xl opacity-30 -z-10" />
                  </motion.div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold">{step.title}</h3>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#00D4FF] to-transparent mx-auto" />
                    <p className="text-muted-foreground text-lg leading-relaxed pt-2">{step.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Creative background with geometric shapes */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-[#00D4FF]/5 to-background" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00D4FF]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00D4FF]/10 rounded-full blur-3xl" />
        
        {/* Geometric accent shapes */}
        <div className="absolute top-20 right-20 w-32 h-32 border-2 border-[#00D4FF]/20 rotate-45" />
        <div className="absolute bottom-20 left-20 w-24 h-24 border-2 border-[#00D4FF]/20 rotate-45" />
        
        <div className="container mx-auto max-w-4xl relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            <div className="relative inline-block mb-8">
              {/* Decorative circle */}
              <div className="absolute inset-0 border-4 border-[#00D4FF]/20 rounded-full animate-pulse" />
              <div className="relative">
                <Trophy className="h-20 w-20 text-[#00D4FF] mx-auto relative z-10" />
                <div className="absolute inset-0 bg-[#00D4FF]/20 blur-2xl rounded-full" />
              </div>
            </div>
            
            <div className="space-y-6 relative">
              {/* Decorative lines */}
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-1 h-32 bg-gradient-to-b from-transparent via-[#00D4FF] to-transparent hidden lg:block" />
              <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-1 h-32 bg-gradient-to-b from-transparent via-[#00D4FF] to-transparent hidden lg:block" />
              
              <h2 className="text-5xl sm:text-6xl font-bold relative">
                <span className="relative z-10">Ready to Start</span>
                <br />
                <span className="bg-gradient-to-r from-[#00D4FF] to-cyan-300 bg-clip-text text-transparent relative z-10">Competing?</span>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-[#00D4FF] to-transparent" />
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Download the challngr mobile app to join competitions, track your progress, and compete with friends - all completely free.
              </p>
            </div>
            
            <div className="mt-12 text-center space-y-4">
              <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-[#00D4FF]/10 border-2 border-[#00D4FF]/30 backdrop-blur-sm">
                <span className="text-3xl">📱</span>
                <div className="text-left">
                  <p className="text-xl font-bold text-foreground">Mobile App Coming Soon</p>
                  <p className="text-sm text-muted-foreground">We're launching on mobile first</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChallngrLogo size="sm" />
            </motion.div>
            <p className="text-sm text-muted-foreground text-center md:text-right">
              © {new Date().getFullYear()} challngr. All rights reserved.
            </p>
        </div>
      </div>
      </footer>

      <SpeedInsights />
    </div>
  );
}
