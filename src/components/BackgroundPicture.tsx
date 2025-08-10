import React from "react";

type BackgroundPictureProps = {
  src: string;
  alt?: string;
  srcSet?: string;
  type?: string;
  sizes?: string;
  priority?: boolean;
  wrapperClassName?: string;
  imgClassName?: string;
  overlayClassName?: string;
  style?: React.CSSProperties;
};

export default function BackgroundPicture({
  src,
  alt = "",
  srcSet,
  type = "image/webp",
  sizes = "100vw",
  priority = false,
  wrapperClassName = "pointer-events-none fixed inset-0 -z-10 h-full w-full overflow-hidden",
  imgClassName = "absolute inset-0 h-full w-full scale-[1.02] object-cover opacity-40 blur-xl dark:opacity-30",
  overlayClassName = "absolute inset-0 h-full w-full bg-gradient-to-b from-transparent to-white dark:to-black",
  style,
}: BackgroundPictureProps) {
  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? "high" : "auto";

  return (
    <picture className={wrapperClassName} style={style}>
      {srcSet && <source type={type} srcSet={srcSet} />}
      <img
        className={imgClassName}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        loading={loading as any}
        fetchPriority={fetchPriority as any}
      />
      <div className={overlayClassName} />
    </picture>
  );
}
