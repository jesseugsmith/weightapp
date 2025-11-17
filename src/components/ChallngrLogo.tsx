import Image from 'next/image';

interface ChallngrLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'full' | 'icon' | 'text'
  className?: string
}

export default function ChallngrLogo({ 
  size = 'md', 
  variant = 'full',
  className = ''
}: ChallngrLogoProps) {
  const sizeClasses = {
    sm: 'h-16',
    md: 'h-24',
    lg: 'h-32',
    xl: 'h-40'
  }

  const widthClasses = {
    sm: 'w-auto',
    md: 'w-auto',
    lg: 'w-auto',
    xl: 'w-auto'
  }

  const imageSizes = {
    sm: { width: 120, height: 120 },
    md: { width: 180, height: 180 },
    lg: { width: 240, height: 240 },
    xl: { width: 320, height: 320 }
  }

  const textSizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-4xl'
  }

  const imageSize = imageSizes[size];

  // For icon variant, show just the logo image
  if (variant === 'icon') {
    return (
      <div className={`${sizeClasses[size]} ${widthClasses[size]} flex items-center justify-center ${className}`}>
        <Image
          src="/challngr-logo.png"
          alt="challngr"
          width={imageSize.width}
          height={imageSize.height}
          className="object-contain h-full w-auto"
          priority
        />
      </div>
    )
  }

  // For text variant, show just the text
  if (variant === 'text') {
    return (
      <h1 className={`${textSizeClasses[size]} font-bold uppercase tracking-tight text-foreground ${className}`}>
        challngr
      </h1>
    )
  }

  // For full variant, show the logo image
  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      <Image
        src="/challngr-logo.png"
        alt="challngr"
        width={imageSize.width}
        height={imageSize.height}
        className="object-contain h-full w-auto"
        priority
      />
    </div>
  )
}

