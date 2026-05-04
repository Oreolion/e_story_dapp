"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Github,
  Twitter,
  Mail,
  ExternalLink,
  Zap,
  Heart,
  Globe,
} from "lucide-react";
import { LogoMark } from "./LogoMark";
import { Separator } from "./ui/separator";

const footerLinks = {
  product: [
    { name: "Features", href: "#features" },
    { name: "Record Stories", href: "/record" },
    { name: "Explore Library", href: "/library" },
    { name: "Social", href: "/social" },
  ],
  community: [
    { name: "Discord", href: "https://discord.com", external: true },
    { name: "Twitter", href: "https://twitter.com", external: true },
    { name: "GitHub", href: "https://github.com", external: true },
    { name: "Blog", href: "#blog" },
  ],
  legal: [
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    { name: "Contact", href: "mailto:contact@estories.app" },
  ],
};

export function Footer() {
  // Your Deployed Contract Addresses (Base Sepolia)
  const CONTRACTS = {
    NFT: "0xF61E9D022Df3835FdFbDD97069F293a39783635B",
    TOKEN: "0xc50E1E89f65cA75CA2994Bf8C9AdB30870cf729a",
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 10 },
    },
  };

  return (
    <footer className="relative mt-20">
      {/* Gradient blur background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 via-indigo-600/5 to-emerald-600/5 pointer-events-none" />

      {/* Main footer content */}
      <div className="relative border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-12 lg:py-16">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12"
          >
            {/* Brand Section */}
            <motion.div
              variants={itemVariants}
              className="lg:col-span-2 space-y-4"
            >
              <Link href="/" className="flex items-center space-x-2 mb-4">
                <motion.div whileHover={{ scale: 1.05, rotate: 5 }}>
                  <LogoMark size={36} />
                </motion.div>
                <span className="text-3xl font-bold bg-gradient-to-r from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] bg-clip-text text-transparent" style={{ fontFamily: "var(--font-brand)", WebkitTextStroke: "0.5px currentColor" }}>
                  eStories
                </span>
              </Link>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed max-w-xs">
                Transform your life stories into lasting digital memories.
                Transform your stories into lasting digital memories in a
                community-driven Web3 ecosystem.
              </p>
              <div className="flex items-center space-x-4 pt-2">
                <motion.a
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 transition-colors"
                  aria-label="Twitter"
                >
                  <Twitter className="w-5 h-5" />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="w-5 h-5" />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  href="mailto:contact@estories.app"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 transition-colors"
                  aria-label="Email"
                >
                  <Mail className="w-5 h-5" />
                </motion.a>
              </div>
            </motion.div>

            {/* Product Links */}
            <motion.div variants={itemVariants}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <span>Product</span>
              </h3>
              <ul className="space-y-3">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center space-x-2 group"
                    >
                      <span>{link.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Community Links */}
            <motion.div variants={itemVariants}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                <span>Community</span>
              </h3>
              <ul className="space-y-3">
                {footerLinks.community.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center space-x-2 group"
                    >
                      <span>{link.name}</span>
                      {link.external && (
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Legal Links */}
            <motion.div variants={itemVariants}>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                <Heart className="w-4 h-4 text-emerald-600" />
                <span>Legal</span>
              </h3>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center space-x-2 group"
                    >
                      <span>{link.name}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
            {/* Step C: Public Verification Links */}
      <div className="flex gap-6 justify-end text-sm">
        <div className="flex flex-col text-right gap-2  md:text-right">
          <span className="font-semibold text-gray-900 dark:text-white">
            Smart Contracts
          </span>
          <div className="flex gap-4 text-gray-500">
            <a
              href={`https://sepolia.basescan.org/address/${CONTRACTS.NFT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-purple-600 flex items-center gap-1"
            >
              NFT Contract <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={`https://sepolia.basescan.org/address/${CONTRACTS.TOKEN}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-600 flex items-center gap-1"
            >
              $STORY Token <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

          {/* Divider */}
          <Separator className="my-8 lg:my-10 bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent" />

          {/* Bottom Section */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0"
          >
            {/* Copyright */}
            <motion.p
              variants={itemVariants}
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              © 2026 EStories. All rights reserved. Built with{" "}
              <Heart className="w-4 h-4 inline text-red-500 animate-pulse" /> by
              the{" "}
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                eStories Team
              </span>
            </motion.p>

            {/* Tech Stack */}
            <motion.div
              variants={itemVariants}
              className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-500"
            >
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-purple-100/50 dark:bg-purple-900/30">
                <Zap className="w-3 h-3" />
                <span>Web3</span>
              </span>
              
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-900/30">
                <span>Blockchain</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-900/30">
                <span>AI</span>
              </span>
            </motion.div>

            {/* Status Badge */}
            <motion.div
              variants={itemVariants}
              className="flex items-center space-x-2 text-sm"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-emerald-500"
              />
              <span className="text-gray-600 dark:text-gray-400">
                All systems operational
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

    

      {/* Subtle gradient bottom accent */}
      <div className="h-1 bg-linear-to-r from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] opacity-50" />
    </footer>
  );
}
