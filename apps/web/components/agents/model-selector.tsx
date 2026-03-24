'use client';

export const MODEL_OPTIONS = [
  {
    category: 'Texto (Free)',
    models: [
      {
        id: 'nvidia/nemotron-3-super-120b-a12b:free',
        label: 'Nemotron 3 Super 120B',
        tier: 'Free',
      },
      { id: 'openai/gpt-oss-120b:free', label: 'GPT OSS 120B', tier: 'Free' },
      { id: 'minimax/minimax-m2.5:free', label: 'MiniMax M2.5', tier: 'Free' },
      { id: 'qwen/qwen3-next-80b-a3b-instruct:free', label: 'Qwen3 Next 80B', tier: 'Free' },
      { id: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air', tier: 'Free' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', tier: 'Free' },
      { id: 'stepfun/step-3.5-flash:free', label: 'Step 3.5 Flash', tier: 'Free' },
      { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder', tier: 'Free' },
      {
        id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
        label: 'Dolphin Mistral 24B',
        tier: 'Free',
      },
      { id: 'sourceful/riverflow-v2-pro', label: 'Riverflow V2 Pro', tier: 'Free' },
      { id: 'sourceful/riverflow-v2-fast', label: 'Riverflow V2 Fast', tier: 'Free' },
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
