# 🎹 Gerador Semântico de MIDI

O **Gerador Semântico de MIDI** é uma ferramenta web experimental que permite a criação de composições musicais a partir de descrições textuais (prompting), unindo semântica e processamento de áudio digital. Além da geração procedural, o projeto oferece suporte para visualização e manipulação de arquivos MIDI e JSON de notas.

## 🚀 Funcionalidades

- **Gerador por Descrição:** Crie melodias e harmonias digitando o que você deseja (ex: "melodia alegre de primavera" ou "tema épico de batalha").
- **Customização Técnica:** Ajuste fino de parâmetros como:
  - Seleção de Instrumentos (Piano, Violão, Violino, Synth, etc.).
  - Controle de Andamento (BPM).
  - Duração da composição em segundos.
- **Importação Multiformato:** - **JSON:** Importe estruturas de notas geradas por outros modelos de IA.
  - **MIDI:** Faça upload de arquivos `.mid` para visualização e processamento.
- **Player Integrado:** Ouça o resultado diretamente no navegador antes de exportar.
- **Exportação:** Download imediato dos arquivos gerados no formato `.mid`.

## 🛠️ Tecnologias Utilizadas

- **HTML5/CSS3:** Interface moderna e responsiva.
- **JavaScript (Vanilla):** Lógica de geração semântica e manipulação de buffers de áudio.
- **MidiWriterJS / Tone.js (ou similar):** Para a síntese sonora e criação do arquivo MIDI.

## 🎨 Como Usar

1. Acesse o [Gerador Semântico](https://jjunninho.github.io/Gerador_Semantico_MID/).
2. Na seção **Gerador por Descrição**, selecione o instrumento e o BPM desejado.
3. Digite uma descrição criativa no campo de texto.
4. Clique em **GERAR MIDI**.
5. Utilize o player para ouvir e clique em **Download MIDI** para salvar sua criação.

## 💡 Exemplos de Prompts

- *"Jazz noturno suave, improvisação relaxante"*
- *"Riff de rock pesado, energético e repetitivo"*
- *"Balada triste em menor, ritmo de valsa lenta"*

---
Desenvolvido por [Jjunninho](https://github.com/Jjunninho)
