/**
 * Module command registry — centralizes all slash command definitions and handlers.
 * Add new modules here; discord.ts delegates to this file.
 */

import { bemCommand, documentoCommand, handleBem, handleDocumento } from '@hawk/module-assets';
import {
  agendaCommand,
  eventCommand,
  handleAgenda,
  handleEvent,
  handleRemind,
  remindCommand,
} from '@hawk/module-calendar';
import {
  certificadoCommand,
  experienciaCommand,
  formacaoCommand,
  handleCertificado,
  handleExperiencia,
  handleFormacao,
  handleHoras,
  handlePerfil,
  handleProjetos,
  handleSkill,
  horasCommand,
  perfilCommand,
  projetosCommand,
  skillCommand,
} from '@hawk/module-career';
import { handleHobby, handleMidia, hobbyCommand, midiaCommand } from '@hawk/module-entertainment';
import {
  gastaCommand,
  handleGasto,
  handleReceita,
  handleSaldo,
  receitaCommand,
  saldoCommand,
} from '@hawk/module-finances';
import {
  corpoCommand,
  exameCommand,
  handleCorpo,
  handleExame,
  handleRemedio,
  handleSaude,
  handleSono,
  handleSubstancia,
  handleTreino,
  remedioCommand,
  saudeCommand,
  sonoCommand,
  substanciaCommand,
  treinoCommand,
} from '@hawk/module-health';
import { contaCommand, handleConta, handleMoradia, moradiaCommand } from '@hawk/module-housing';
import { diarioCommand, handleDiario } from '@hawk/module-journal';
import { handleLivro, handleNota, livroCommand, notaCommand } from '@hawk/module-knowledge';
import {
  contratosCommand,
  handleContratos,
  handleObrigacoes,
  obrigacoesCommand,
} from '@hawk/module-legal';
import { handleMeta, handleTarefa, metaCommand, tarefaCommand } from '@hawk/module-objectives';
import {
  aniversariosCommand,
  comoNosConhecemosCommand,
  contatosCommand,
  dormentesCommand,
  handleAniversarios,
  handleComoNosConhecemos,
  handleContatos,
  handleDormentes,
  handleInteracao,
  handleLembrar,
  handlePessoa,
  interacaoCommand,
  lembrarCommand,
  pessoaCommand,
} from '@hawk/module-people';
import { habitoCommand, handleHabito } from '@hawk/module-routine';
import { handleSeguranca, segurancaCommand } from '@hawk/module-security';
import { handlePost, postCommand } from '@hawk/module-social';
import { handleReflexao, reflexaoCommand } from '@hawk/module-spirituality';
import type { ChatInputCommandInteraction } from 'discord.js';

// ── All registered slash commands (sent to Discord on startup) ─────────────────

export const ALL_COMMANDS = [
  // Finances
  gastaCommand,
  receitaCommand,
  saldoCommand,
  // Calendar
  eventCommand,
  agendaCommand,
  remindCommand,
  // Routine + Journal + Objectives
  habitoCommand,
  diarioCommand,
  metaCommand,
  tarefaCommand,
  // People
  pessoaCommand,
  interacaoCommand,
  aniversariosCommand,
  contatosCommand,
  comoNosConhecemosCommand,
  lembrarCommand,
  dormentesCommand,
  // Career
  horasCommand,
  projetosCommand,
  perfilCommand,
  experienciaCommand,
  formacaoCommand,
  skillCommand,
  certificadoCommand,
  // Legal
  obrigacoesCommand,
  contratosCommand,
  // Knowledge + Assets + Housing + Security
  notaCommand,
  livroCommand,
  bemCommand,
  documentoCommand,
  moradiaCommand,
  contaCommand,
  segurancaCommand,
  // Health
  saudeCommand,
  sonoCommand,
  treinoCommand,
  corpoCommand,
  remedioCommand,
  substanciaCommand,
  exameCommand,
  // Entertainment + Social + Spirituality
  midiaCommand,
  hobbyCommand,
  postCommand,
  reflexaoCommand,
];

// ── Slash command dispatch ─────────────────────────────────────────────────────

export async function handleSlashCommand(cmd: ChatInputCommandInteraction): Promise<void> {
  switch (cmd.commandName) {
    // Finances
    case 'gasto':
      await handleGasto(cmd);
      break;
    case 'receita':
      await handleReceita(cmd);
      break;
    case 'saldo':
      await handleSaldo(cmd);
      break;
    // Calendar
    case 'event':
      await handleEvent(cmd);
      break;
    case 'agenda':
      await handleAgenda(cmd);
      break;
    case 'remind':
      await handleRemind(cmd);
      break;
    // Routine + Journal + Objectives
    case 'habito':
      await handleHabito(cmd);
      break;
    case 'diario':
      await handleDiario(cmd);
      break;
    case 'meta':
      await handleMeta(cmd);
      break;
    case 'tarefa':
      await handleTarefa(cmd);
      break;
    // People
    case 'pessoa':
      await handlePessoa(cmd);
      break;
    case 'interacao':
      await handleInteracao(cmd);
      break;
    case 'aniversarios':
      await handleAniversarios(cmd);
      break;
    case 'contatos':
      await handleContatos(cmd);
      break;
    case 'como-nos-conhecemos':
      await handleComoNosConhecemos(cmd);
      break;
    case 'lembrar':
      await handleLembrar(cmd);
      break;
    case 'dormentes':
      await handleDormentes(cmd);
      break;
    // Career
    case 'horas':
      await handleHoras(cmd);
      break;
    case 'projetos':
      await handleProjetos(cmd);
      break;
    case 'perfil':
      await handlePerfil(cmd);
      break;
    case 'experiencia':
      await handleExperiencia(cmd);
      break;
    case 'formacao':
      await handleFormacao(cmd);
      break;
    case 'skill':
      await handleSkill(cmd);
      break;
    case 'certificado':
      await handleCertificado(cmd);
      break;
    // Legal
    case 'obrigacoes':
      await handleObrigacoes(cmd);
      break;
    case 'contratos':
      await handleContratos(cmd);
      break;
    // Knowledge + Assets + Housing + Security
    case 'nota':
      await handleNota(cmd);
      break;
    case 'livro':
      await handleLivro(cmd);
      break;
    case 'bem':
      await handleBem(cmd);
      break;
    case 'documento':
      await handleDocumento(cmd);
      break;
    case 'moradia':
      await handleMoradia(cmd);
      break;
    case 'conta':
      await handleConta(cmd);
      break;
    case 'seguranca':
      await handleSeguranca(cmd);
      break;
    // Health
    case 'saude':
      await handleSaude(cmd);
      break;
    case 'sono':
      await handleSono(cmd);
      break;
    case 'treino':
      await handleTreino(cmd);
      break;
    case 'corpo':
      await handleCorpo(cmd);
      break;
    case 'remedio':
      await handleRemedio(cmd);
      break;
    case 'substancia':
      await handleSubstancia(cmd);
      break;
    case 'exame':
      await handleExame(cmd);
      break;
    // Entertainment + Social + Spirituality
    case 'midia':
      await handleMidia(cmd);
      break;
    case 'hobby':
      await handleHobby(cmd);
      break;
    case 'post':
      await handlePost(cmd);
      break;
    case 'reflexao':
      await handleReflexao(cmd);
      break;
    default:
      await cmd.reply({ content: 'Comando desconhecido.', ephemeral: true });
  }
}
