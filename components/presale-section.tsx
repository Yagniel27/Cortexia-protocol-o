"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Lock, Unlock, ArrowUp, ArrowDown, Loader2, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react"
import { useInView } from "@/hooks/use-in-view"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { ethers } from "ethers"

const DESTINATION_WALLET = "0x5079d41c8b0a91ec33180561600ec900669cfacc"

// ============================================================
// PRESALE COUNTDOWN — Cambia esta fecha para tus pruebas
// Formato: "YYYY-MM-DDTHH:MM:SSZ" (hora UTC)
// Ejemplo testnet rapido: new Date(Date.now() + 1000 * 60 * 2) -> 2 minutos
// ============================================================
const PRESALE_TARGET_DATE = new Date("2026-03-15T18:00:00Z")

type TransactionState = "idle" | "pending" | "success" | "error"

const phases = [
  { id: 1, name: "Fase 1", allocation: "5%", price: "$0.001", status: "active" as const },
  { id: 2, name: "Fase 2", allocation: "10%", price: "$0.002", status: "locked" as const },
  { id: 3, name: "Fase 3", allocation: "15%", price: "$0.003", status: "locked" as const },
]

function useCountdown(targetDate: Date) {
  const calculateTimeLeft = useCallback(() => {
    const now = new Date().getTime()
    const target = targetDate.getTime()
    const diff = Math.max(0, target - now)

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
    }
  }, [targetDate])

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [calculateTimeLeft])

  return { ...timeLeft, mounted }
}

export function PresaleSection() {
  const [amount, setAmount] = useState("")
  const [selectedPhase] = useState(1)
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef, { threshold: 0.2 })
  const { mounted, ...timeLeft } = useCountdown(PRESALE_TARGET_DATE)
  const isCountdownDone =
    timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0
  const isPresaleActive = mounted && isCountdownDone
  const showCountdown = mounted && !isCountdownDone

  const [walletAddress, setWalletAddress] = useState<string>("")
  const [balance, setBalance] = useState<string>("0.00")
  const [isConnected, setIsConnected] = useState(false)
  const [txState, setTxState] = useState<TransactionState>("idle")
  const [txHash, setTxHash] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false)
  const [networkName, setNetworkName] = useState<string>("")

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      setIsMetaMaskInstalled(true)
      checkIfWalletIsConnected()
    }
  }, [])

  const checkIfWalletIsConnected = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.listAccounts()

      if (accounts.length > 0) {
        const signer = await provider.getSigner()
        const address = await signer.getAddress()
        setWalletAddress(address)
        setIsConnected(true)
        await updateBalance(address)
        await updateNetworkName()
      }
    } catch (error) {
      console.log("Wallet not connected yet")
    }
  }

  const updateNetworkName = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()

      const networkNames: { [key: number]: string } = {
        1: "Ethereum Mainnet",
        56: "BSC Mainnet",
        97: "BSC Testnet",
        137: "Polygon",
        80001: "Polygon Mumbai",
      }

      const name = networkNames[Number(network.chainId)] || `Chain ID: ${network.chainId}`
      setNetworkName(name)
    } catch (error) {
      console.error("Error getting network:", error)
    }
  }

  const connectWallet = async () => {
    if (!isMetaMaskInstalled) {
      setErrorMessage("Por favor instala MetaMask para continuar")
      return
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)

      await provider.send("eth_requestAccounts", [])

      const signer = await provider.getSigner()
      const address = await signer.getAddress()

      setWalletAddress(address)
      setIsConnected(true)
      setErrorMessage("")

      await updateBalance(address)
      await updateNetworkName()
    } catch (error: any) {
      console.error("Error connecting wallet:", error)
      setErrorMessage("Error al conectar la wallet")
    }
  }

  const updateBalance = async (address: string) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const balanceWei = await provider.getBalance(address)
      const balanceEth = ethers.formatEther(balanceWei)
      setBalance(Number.parseFloat(balanceEth).toFixed(4))
    } catch (error) {
      console.error("Error getting balance:", error)
    }
  }

  const validateTransaction = (): string | null => {
    const amountNum = Number.parseFloat(amount)

    if (!amount || isNaN(amountNum)) {
      return "Por favor ingresa un monto válido"
    }

    if (amountNum <= 0) {
      return "El monto debe ser mayor que 0"
    }

    const balanceNum = Number.parseFloat(balance)
    if (amountNum > balanceNum) {
      return "Fondos insuficientes en tu wallet"
    }

    return null
  }

  const handleBuyTokens = async () => {
    if (!isConnected) {
      await connectWallet()
      return
    }

    const validationError = validateTransaction()
    if (validationError) {
      setErrorMessage(validationError)
      setTxState("error")
      return
    }

    setTxState("pending")
    setErrorMessage("")
    setTxHash("")

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const amountWei = ethers.parseEther(amount)

      const tx = await signer.sendTransaction({
        to: DESTINATION_WALLET,
        value: amountWei,
      })

      console.log("Transaction sent:", tx.hash)
      setTxHash(tx.hash)

      await tx.wait()

      console.log("Transaction confirmed")
      setTxState("success")

      const address = await signer.getAddress()
      await updateBalance(address)
    } catch (error: any) {
      console.error("Transaction error:", error)

      let errorMsg = "Error al procesar la transacción"

      if (error.code === "ACTION_REJECTED" || error.code === 4001) {
        errorMsg = "Transacción rechazada por el usuario"
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        errorMsg = "Fondos insuficientes para completar la transacción"
      } else if (error.message) {
        errorMsg = error.message
      }

      setErrorMessage(errorMsg)
      setTxState("error")
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const calculateTokens = (value: string) => {
    const num = Number.parseFloat(value) || 0
    return (num / 0.001).toLocaleString()
  }

  const getBlockExplorerUrl = () => {
    return `https://bscscan.com/tx/${txHash}`
  }

  return (
    <section id="presale" ref={sectionRef} className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(0,212,255,0.1)_0%,_transparent_70%)]" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={cn(
            "text-center mb-12 transition-all duration-1000",
            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
          )}
        >
          <div className="flex justify-center mb-4">
            <Image
              src="/images/cortexia-icono.png"
              alt="Cortexia"
              width={64}
              height={64}
              className="animate-pulse-glow"
            />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            <span className="holographic-text">Únete a la Preventa</span>
          </h2>
          <p className="text-lg text-gray-400">Sé parte del futuro de la IA descentralizada</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-sm text-gray-500">Powered by</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1A2E] border border-[#F3BA2F]/30">
              <Image src="/images/binance-icon-seeklogo.svg" alt="Binance Smart Chain" width={20} height={20} />
              <span className="text-sm font-medium text-[#F3BA2F]">BSC</span>
            </div>
          </div>
        </div>

        {/* Countdown Timer */}
        {showCountdown && (
          <div
            className={cn(
              "mb-10 transition-all duration-1000 delay-200",
              isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
            )}
          >
            <p className="text-center text-base sm:text-lg text-gray-300 mb-4 tracking-wide font-medium">
              Preventa comienza en...
            </p>
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 sm:gap-4 px-5 sm:px-8 py-4 sm:py-5 rounded-xl bg-[#1A1A2E]/50 border border-[#0066FF]/15 backdrop-blur-sm">
                {[
                  { value: timeLeft.days, label: "dias" },
                  { value: timeLeft.hours, label: "horas" },
                  { value: timeLeft.minutes, label: "min" },
                  { value: timeLeft.seconds, label: "seg" },
                ].map((unit, index) => (
                  <div key={unit.label} className="flex items-center gap-2 sm:gap-4">
                    <div className="flex flex-col items-center min-w-[40px] sm:min-w-[52px]">
                      <span className="text-[28px] sm:text-[40px] font-bold leading-none text-[#00D4FF] tabular-nums">
                        {String(unit.value).padStart(2, "0")}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-gray-500 mt-1 uppercase tracking-widest">
                        {unit.label}
                      </span>
                    </div>
                    {index < 3 && (
                      <span className="text-[22px] sm:text-[32px] font-light text-[#0066FF]/40 leading-none -mt-3 sm:-mt-4 select-none">
                        :
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div
          className={cn(
            "grid lg:grid-cols-2 gap-8 transition-all duration-1000",
            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
          )}
        >
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Fases de Preventa</h3>

            {phases.map((phase) => {
              const isPhaseUnlocked = phase.status === "active" && isPresaleActive

              return (
                <div
                  key={phase.id}
                  className={cn(
                    "relative p-4 rounded-xl transition-all duration-300",
                    isPhaseUnlocked
                      ? "glass-card border-[#00D4FF]/50 shadow-[0_0_30px_rgba(0,212,255,0.2)]"
                      : "bg-[#1A1A2E]/50 grayscale opacity-60 cursor-not-allowed",
                  )}
                >
                  {!isPhaseUnlocked && <div className="absolute inset-0 rounded-xl backdrop-blur-[2px]" />}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isPhaseUnlocked ? "bg-gradient-to-br from-[#0066FF] to-[#00D4FF]" : "bg-[#1A1A2E]",
                        )}
                      >
                        {isPhaseUnlocked ? (
                          <Unlock className="w-5 h-5 text-white" />
                        ) : (
                          <Lock className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{phase.name}</h4>
                        <p className="text-sm text-gray-400">{phase.allocation} del supply</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#00D4FF]">{phase.price}</p>
                      <p className="text-xs text-gray-500">por CTX</p>
                    </div>
                  </div>

                  {isPhaseUnlocked && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Progreso</span>
                        <span className="text-[#00D4FF]">37%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#1A1A2E] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#0066FF] to-[#00D4FF] relative"
                          style={{ width: "37%" }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-scan" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="glass-card p-6 rounded-2xl border-[#0066FF]/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Comprar CTX</h3>
              <div className="flex items-center gap-2">
                <Image src="/images/cortexia-icono.png" alt="Cortexia" width={24} height={24} />
              </div>
            </div>

            {isConnected && walletAddress && (
              <div className="mb-4 p-3 rounded-lg bg-[#1A1A2E] border border-[#00D4FF]/30">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-gray-400">Conectado</p>
                    <p className="text-sm font-mono text-[#00D4FF]">{formatAddress(walletAddress)}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
                </div>
                {networkName && (
                  <div className="mt-2 pt-2 border-t border-[#0066FF]/20">
                    <p className="text-xs text-gray-500">
                      Red: <span className="text-gray-400">{networkName}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isMetaMaskInstalled && (
              <div className="mb-4 p-4 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#FF6B00] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#FF6B00] mb-1">MetaMask no detectado</p>
                    <p className="text-xs text-gray-400">
                      Instala MetaMask para conectar tu wallet y participar en la preventa.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="p-4 rounded-xl bg-[#1A1A2E] border border-[#0066FF]/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">De</span>
                  <span className="text-xs text-gray-500">Balance: {balance}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.001"
                    min="0"
                    disabled={txState === "pending" || !isPresaleActive}
                    className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none disabled:opacity-50"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0A0A0A] border border-[#F3BA2F]/30 shrink-0">
                    <Image src="/images/binance-icon-seeklogo.svg" alt="BNB" width={24} height={24} />
                    <span className="font-semibold text-white">BNB</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center -my-1 relative z-10">
                <div className="flex items-center gap-0.5 p-2 rounded-xl bg-[#1A1A2E] border border-[#0066FF]/30 shadow-lg">
                  <ArrowDown className="w-4 h-4 text-[#00D4FF]" />
                  <ArrowUp className="w-4 h-4 text-[#0066FF]" />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#00D4FF]/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">A</span>
                  <span className="text-xs text-gray-500">Recibirás</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-2xl font-bold text-[#00D4FF]">{calculateTokens(amount) || "0"}</span>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1A1A2E] border border-[#00D4FF]/30 shrink-0">
                    <Image src="/images/cortexia-icono.png" alt="CTX" width={24} height={24} />
                    <span className="font-semibold text-[#00D4FF]">CTX</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-2 py-2 text-sm">
                <span className="text-gray-500">Precio</span>
                <span className="text-gray-400">1 CTX = $0.001</span>
              </div>

              {txState === "error" && errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-400">{errorMessage}</p>
                  </div>
                </div>
              )}

              {txState === "success" && txHash && (
                <div className="p-4 rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/30">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#00D4FF] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#00D4FF] mb-2">Transacción exitosa</p>
                      <a
                        href={getBlockExplorerUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#00D4FF] transition-colors"
                      >
                        <span className="font-mono">{formatAddress(txHash)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleBuyTokens}
                disabled={txState === "pending" || !isPresaleActive}
                className="group relative w-full py-4 bg-gradient-to-r from-[#0066FF] to-[#00D4FF] rounded-xl font-semibold text-lg overflow-hidden transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,102,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {!isPresaleActive ? (
                    <>
                      <Lock className="w-5 h-5" />
                      Preventa aun no disponible
                    </>
                  ) : txState === "pending" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Confirmando transacción...
                    </>
                  ) : isConnected ? (
                    "Comprar Ahora"
                  ) : (
                    "Conectar Wallet"
                  )}
                </span>
                {txState !== "pending" && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute inset-0 rounded-xl overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent animate-scan" />
                      <div
                        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white to-transparent animate-scan"
                        style={{ animationDelay: "1.5s" }}
                      />
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
