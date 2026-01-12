import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-teal-50 via-blue-50 to-cyan-50">
      <div className="text-center">
        <div className="bg-teal-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-gray-800 mb-4">MandatoPro</h1>
        <p className="text-gray-600 mb-8">Sistema de Gestão Política</p>
        <Link href="/login">
          <button className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-lg transition transform hover:scale-105 shadow-lg">
            Acessar Sistema
          </button>
        </Link>
      </div>
    </div>
  );
}
