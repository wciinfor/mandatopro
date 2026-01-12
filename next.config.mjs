/** @type {import('next').NextConfig} */
const nextConfig = {
  // Otimizações para Vercel
  compress: true,
  poweredByHeader: false,
  
  // Configurações de imagem
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Desenvolvimento local
  allowedDevOrigins: [
    '192.168.1.7',
    'localhost',
    '127.0.0.1'
  ],

  // Headers de segurança
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ];
  },

  // Redirects
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      }
    ];
  },

  // Rewrites
  rewrites: async () => {
    return {
      beforeFiles: [],
      afterFiles: []
    };
  }
};

export default nextConfig;
