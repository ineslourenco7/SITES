import { Link } from "wouter";
import { motion } from "framer-motion";
import { Terminal, Zap, Code, Package, ArrowRight, Infinity, Lock, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

const TEMPLATES = [
  { name: "Landing Page", icon: Package },
  { name: "SaaS Dashboard", icon: Terminal },
  { name: "Booking App", icon: Zap },
  { name: "E-commerce", icon: Package },
  { name: "Trading Dashboard", icon: Code },
  { name: "Portfolio", icon: Terminal },
  { name: "Blog", icon: Package },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Navbar */}
      <header className="w-full border-b border-border/50 bg-background/95 backdrop-blur z-50 sticky top-0">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Zap className="w-5 h-5 text-primary" />
            <span>AI Builder</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Settings
            </Link>
            <Link href="/builder">
              <Button size="sm" className="gap-2">
                Open Workspace <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col">
        {/* Hero Section */}
        <section className="w-full py-32 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="z-10 max-w-3xl"
          >
            <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-500 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
                <Infinity className="w-3.5 h-3.5" /> Unlimited generations
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 px-3 py-1 rounded-full">
                <Lock className="w-3.5 h-3.5" /> 100% private
              </span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-purple-400 bg-purple-400/10 border border-purple-400/20 px-3 py-1 rounded-full">
                <Cpu className="w-3.5 h-3.5" /> Runs on your machine
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              Build apps by <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                chatting with AI
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              No API keys. No credits. No limits. Generate full-stack web projects instantly using your local Ollama models — completely free, forever.
            </p>
            
            <div className="flex items-center justify-center gap-4">
              <Link href="/builder">
                <Button size="lg" className="h-12 px-8 text-base font-medium gap-2">
                  Start Building <Zap className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/settings">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base font-medium">
                  Configure Ollama
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Templates */}
        <section className="w-full py-20 bg-muted/20 border-t border-border/50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold mb-8 text-center">Quick Start Templates</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {TEMPLATES.map((t, i) => (
                <Link key={i} href={`/builder?template=${encodeURIComponent(t.name)}`}>
                  <div className="p-6 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all cursor-pointer group flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <t.icon className="w-6 h-6" />
                    </div>
                    <span className="font-medium">{t.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
