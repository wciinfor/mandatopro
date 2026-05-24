import Layout from '@/components/Layout';

export default function Disparos() {
  return (
    <Layout title="Disparos">
      <div className="min-h-[calc(100vh-64px)] bg-gray-50">
        <iframe
          title="Disparo PRO"
          src="/disparo-pro/index.html"
          className="w-full h-[calc(100vh-64px)] border-0 bg-white"
        />
      </div>
    </Layout>
  );
}
