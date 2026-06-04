# Viagem Carol & Naka — Romênia & Alemanha 2026 🇪🇺✈️

Este repositório contém o guia de viagem interativo e personalizado para a jornada de Carol e Naka à Romênia (Timișoara) e Alemanha (Berlim e Leipzig) em junho-julho de 2026.

## Cronograma Resumido
* **Leipzig (23 Jun a 26 Jun)**: Colaboração técnica de pesquisa na **DBFZ** (24 e 25 de Junho).
* **Berlim (26 Jun a 28 Jun)**.
* **Timișoara (29 Jun a 05 Jul)**: Apresentações e conferência no **FOSS4G Europe 2026**.
* **Berlim (05 Jul a 08 Jul)**: Show do **Critical Role Live** na Uber Arena (07 de Julho).
* **Retorno (08 Jul a 10 Jul)**: Voo via Air Canada com conexão em Montreal.

## Funcionalidades do App (Companion)
* **📴 Offline-first de verdade:** todas as imagens dos destinos e ícones são pré-cacheadas pelo Service Worker, então o guia funciona 100% sem internet no exterior.
* **🌐 Indicador de conexão:** mostra no cabeçalho se você está online ou offline.
* **⬇️ Instalável:** botão dedicado para adicionar o guia à tela inicial (PWA) + atalhos rápidos (Agenda de hoje, Emergência, Gastos).
* **💱 Conversor bidirecional:** digite em qualquer moeda (EUR ↔ RON ↔ BRL) e as outras se convertem na hora; taxas ao vivo via `frankfurter.app` com fallback offline.
* **🧾 Rastreador de gastos:** registre despesas em EUR/RON/BRL com total da viagem convertido para BRL, salvo offline.
* **📝 Diário de viagem:** anotações por dia direto na Agenda, guardadas no aparelho.
* **🌦️ Clima ao vivo:** temperatura real por cidade via `open-meteo.com` (network-first, com cache offline).

## Tecnologias
Construído com HTML5 estático, CSS3 premium (responsivo e mobile-first) e JavaScript leve e performático para injeção dinâmica de conteúdo e modais bottom-sheet. PWA com Service Worker (cache-first para o app, network-first para câmbio e clima) e persistência via LocalStorage.
