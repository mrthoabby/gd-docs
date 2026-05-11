import type { SVGProps } from 'react';

export const ProductLogoIcon = ({
  width = 24,
  height = 24,
  ...props
}: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect width="24" height="24" rx="7" fill="url(#documentor-logo-bg)" />
      <path
        d="M7 5.75h7.25L18 9.5v8.75H7V5.75Z"
        fill="#0f172a"
        fillOpacity="0.45"
        stroke="white"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M14.25 5.75V9.5H18" stroke="white" strokeWidth="1.4" />
      <path
        d="M9.35 12.15h5.3M9.35 15h4.1"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="documentor-logo-bg"
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#2dd4bf" />
          <stop offset="0.48" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
    </svg>
  );
};
