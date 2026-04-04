'use client';

export const MODEL_OPTIONS = [
  {
    category: 'Com suporte a tools (Free)',
    models: [
      { id: 'qwen/qwen3.6-plus:free', label: 'Qwen3.6 Plus (1M ctx)', tier: 'Free' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 120B (262K)', tier: 'Free' },
      { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (262K)', tier: 'Free' },
      {
        id: 'nvidia/nemotron-3-nano-30b-a3b:free',
        label: 'Nemotron Nano 30B (256K)',
        tier: 'Free',
      },
      { id: 'openai/gpt-oss-120b:free', label: 'GPT OSS 120B (131K)', tier: 'Free' },
      { id: 'openai/gpt-oss-20b:free', label: 'GPT OSS 20B (131K)', tier: 'Free' },
      { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (131K)', tier: 'Free' },
      { id: 'google/gemma-3-12b-it:free', label: 'Gemma 3 12B (131K)', tier: 'Free' },
      {
        id: 'mistralai/mistral-small-3.2-24b-instruct:free',
        label: 'Mistral Small 3.2 24B',
        tier: 'Free',
      },
      { id: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air (131K)', tier: 'Free' },
      { id: 'nvidia/nemotron-nano-9b-v2:free', label: 'Nemotron Nano 9B (128K)', tier: 'Free' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (65K)', tier: 'Free' },
    ],
  },
  {
    category: 'Sem suporte a tools (Free)',
    models: [
      { id: 'deepseek/deepseek-r1-0528:free', label: 'DeepSeek R1 0528 (163K)', tier: 'Free' },
      { id: 'stepfun/step-3.5-flash:free', label: 'Step 3.5 Flash (256K)', tier: 'Free' },
      { id: 'minimax/minimax-m2.5:free', label: 'MiniMax M2.5', tier: 'Free' },
      { id: 'nousresearch/hermes-3-llama-3.1-405b:free', label: 'Hermes 3 405B', tier: 'Free' },
      {
        id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
        label: 'Dolphin Mistral 24B',
        tier: 'Free',
      },
    ],
  },
  {
    category: 'Imagem',
    models: [
      { id: 'bytedance-seed/seedream-4.5', label: 'Seedream 4.5', tier: 'Img' },
      { id: 'black-forest-labs/flux.2-klein-4b', label: 'FLUX.2 Klein', tier: 'Img' },
      { id: 'black-forest-labs/flux.2-max', label: 'FLUX.2 Max', tier: 'Img' },
    ],
  },
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  return (
    <div className="space-y-[var(--space-6)]">
      {MODEL_OPTIONS.map((category) => (
        <div key={category.category}>
          <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-2)] block">
            {category.category}
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-2)]">
            {category.models.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => onModelChange(model.id)}
                className={`flex items-center justify-between p-[var(--space-3)] rounded-[var(--radius-md)] text-left transition-colors ${
                  selectedModel === model.id
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-1)]'
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{model.label}</div>
                  <div
                    className={`text-[10px] font-mono ${
                      selectedModel === model.id
                        ? 'text-white/60'
                        : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {model.id}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    selectedModel === model.id
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {model.tier}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <label
          htmlFor="custom-model"
          className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-2)] block"
        >
          Custom (model ID manual)
        </label>
        <input
          id="custom-model"
          type="text"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="vendor/model-name"
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-sm font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>
    </div>
  );
}
