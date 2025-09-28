// Animation variants for reusable animations
export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

export const popIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20
    }
  }
};

export const staggerChildren = {
  visible: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const slideInFromRight = {
  hidden: { x: 50, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 20
    }
  }
};

export const buttonTapAnimation = {
  scale: 0.95,
  transition: { type: "spring", stiffness: 400, damping: 10 }
};

export const bounceScale = {
  scale: [1, 1.1, 1],
  transition: { duration: 0.4 }
};

export const successAnimation = {
  scale: [1, 1.2, 1],
  rotate: [0, 360],
  transition: {
    duration: 0.6,
    ease: "easeInOut"
  }
};

export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 }
};
