interface FitClashLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon' | 'text'
  className?: string
}

export default function FitClashLogo({ 
  size = 'md', 
  variant = 'full',
  className = ''
}: FitClashLogoProps) {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-10',
    lg: 'h-16',
    xl: 'h-20'
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-5xl'
  }

  const iconSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-5xl'
  }

  if (variant === 'icon') {
    return (
      <div className={`${sizeClasses[size]} flex items-center justify-center ${className}`}>
        <div className="relative">
          {/* Lightning bolt 1 */}
          <div className={`${iconSizeClasses[size]} text-blue-400 absolute`}>⚡</div>
          {/* Lightning bolt 2 - crossed */}
          <div className={`${iconSizeClasses[size]} text-orange-400 absolute transform rotate-45 translate-x-1`}>⚡</div>
          {/* Dumbbell in center */}
          <div className={`${iconSizeClasses[size]} text-gray-300 absolute transform translate-x-2 translate-y-1 scale-75`}>🏋️</div>
        </div>
      </div>
    )
  }

  if (variant === 'text') {
    return (
      <h1 className={`${textSizeClasses[size]} font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-orange-400 bg-clip-text text-transparent ${className}`}>
        FitClash
      </h1>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <FitClashLogo size={size} variant="icon" />
      <FitClashLogo size={size} variant="text" />
    </div>
  )
}
