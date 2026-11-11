# Kairós

> *Kairós* é o momento oportuno. O app ajuda a perceber **o que é mais importante agora**, inclusive comer, beber água, tomar banho e descansar.

Kairós é um definidor de prioridades focado em **autocuidado**, pensado especialmente para pessoas neurodivergentes. Ele lembra de iniciar e finalizar tarefas (trabalho, faculdade, escola), mas, com o passar das horas, lembra também de cuidar de si.

## Como funciona

1. **Primeiro acesso:** nome, horário de acordar e dormir, contextos (trabalho, faculdade...) e quais cuidados ativar.
2. **Triagem:** perguntas rápidas, uma por tela, que sempre podem ser puladas ("Quando você comeu pela última vez?", "Como está sua energia?"...).
3. **Agora:** mostra **uma** prioridade por vez, com o motivo e um *primeiro passo minúsculo* ("Só encha um copo e deixe perto de você"), para contornar a dificuldade de começar.
4. **Notificações:** os lembretes chegam mesmo com o app fechado, com os botões **Feito ✓** e **Mais tarde** direto na notificação.

### Motor de prioridade ([src/engine/priority.ts](src/engine/priority.ts))

| Sinal | Efeito |
| --- | --- |
| Tempo desde a última vez ÷ intervalo do cuidado | Quanto mais atrasado, mais urgente (com peso maior para comer, água e medicação) |
| Prazo / horário de início da tarefa | Sobe conforme se aproxima (< 1h é quase o topo) |
| Energia baixa na triagem | Prioriza o corpo e rebaixa tarefas pesadas |
| Muito tempo em foco | Puxa uma pausa, água e comida |
| Perto da hora de dormir | Sugere desacelerar e rebaixa tarefas |
| Horário de sono | Nenhum lembrete; só "Descansar" |

Regra de ouro: **fome muito atrasada passa na frente de uma tarefa com prazo em 2h**.

## Tecnologias

- **React + TypeScript + Vite** para as telas
- **Capacitor** para empacotar como app Android híbrido
- **Kotlin** para o módulo nativo de lembretes (`AlarmManager`, notificações com ações, reagendamento após reiniciar o celular), em [android/app/src/main/java/br/com/kairos/app/notifier/](android/app/src/main/java/br/com/kairos/app/notifier/)
- **Supabase** para conta (código por e-mail, sem senha) e sincronização entre aparelhos

O app é **local-first**: funciona totalmente offline e sem conta. Ao entrar, o estado é espelhado no Supabase.

```
React (src/)                         Kotlin (android/.../notifier/)
┌──────────────────────┐  schedule  ┌─────────────────────────────┐
│ motor de prioridade  │──────────► │ ReminderScheduler           │
│ upcomingReminders()  │            │  └► AlarmManager            │
│                      │ consume-   │ ReminderReceiver → notifica │
│ aplica "Feito"/      │◄────────── │ NotificationActionReceiver  │
│ "Mais tarde"         │  Actions   │ BootReceiver (reagenda)     │
└─────────┬────────────┘            └─────────────────────────────┘
          │ supabase-js
          ▼
   Supabase: app_state (jsonb) · care_logs
```

## Rodando

### Pré-requisitos
- Node 20+
- Android Studio (com Android SDK) para gerar o APK

### Desenvolvimento no navegador
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes do motor de prioridade
```
No navegador, as notificações funcionam só com a aba aberta. Os lembretes de verdade vêm do módulo Kotlin.

### Supabase
1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode [supabase/migrations/20261111000000_init.sql](supabase/migrations/20261111000000_init.sql).
3. Em **Authentication → Email Templates → Magic Link**, inclua o código no corpo do e-mail:
   ```html
   <p>Seu código do Kairós: <strong>{{ .Token }}</strong></p>
   ```
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings → API).

Sem `.env`, o app funciona normalmente, apenas sem a opção de conta.

### Android
```bash
npm run android:sync   # build do React + copia para o projeto Android
npm run android:open   # abre no Android Studio → Run ▶
```

## Estrutura

```
src/
  engine/       motor de prioridade + agenda de lembretes (com testes)
  state/        estado local, sessão/sincronização e hooks
  lib/          cliente Supabase e ponte com o plugin nativo
  screens/      Onboarding, Triagem, Agora, Tarefas, Autocuidado, Ajustes
android/        projeto Android (Capacitor) + plugin Kotlin
supabase/       esquema do banco com RLS
public/icons/   ícones gerados a partir de logotipo/logo.png
```

## Acessibilidade e tom

- Fonte **Atkinson Hyperlegible** (embutida, funciona offline), alvos de toque ≥ 52px, respeita "reduzir movimento".
- Tema escuro e claro conforme o sistema. Paleta: azul (primária), lilás, branco e preto.
- Linguagem sem culpa: "O prazo passou — tudo bem, ainda dá para resolver ou renegociar."
