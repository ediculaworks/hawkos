---
name: design-review
description: Review and improve UI components for visual quality and consistency
user-invocable: true
---

# Design Review Skill

## Anti-Patterns a Evitar
- Fonte Inter genérica (usar system fonts ou específicas)
- Gray-on-colored backgrounds (baixo contraste)
- Nested cards (flattenar hierarquia)
- Gradients desnecessários
- Bordas excessivas
- Spacing inconsistente
- Rounded corners exagerados
- Drop shadows sem propósito

## Checklist de Review
1. **Tipografia**: hierarchy clara (h1 > h2 > body > caption), max 2 font weights por componente
2. **Cores**: max 3 cores primárias, usar CSS variables do design system
3. **Spacing**: usar scale consistente (4, 8, 12, 16, 24, 32, 48px)
4. **Responsividade**: mobile-first, testar lg/md/sm breakpoints
5. **Estados**: hover, focus, disabled, loading, empty, error
6. **Acessibilidade**: contraste 4.5:1 min, focus-visible, aria labels
7. **Densidade**: informação útil por pixel — não desperdiçar espaço
8. **Consistência**: componentes similares devem ter padrões visuais idênticos

## Quando Usar
- Antes de shipar uma página nova
- Após implementar componentes de dashboard
- Quando UI "parece AI slop" e precisa de polish
