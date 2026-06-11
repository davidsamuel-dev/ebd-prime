## Documento de Requisitos: EBD Prime

> **Obsoleto como documento principal.** Use **`docs/DOCUMENTO_ESPECIFICACAO_EBD_PRIME.md`** (modelo IFTO).  
> Estado actual: `docs/ESTADO_DO_PROJETO.md` · Requisitos: `requisitos_ebd_prime.txt` / `requisitos_ebd_prime_publico.txt`  
> Este ficheiro mantém-se apenas como referência histórica dos RF legados (RF01, RF02, …).



Com base na evolução do projeto e nas definições técnicas estabelecidas para a infraestrutura e arquitetura, aqui está a atualização do Documento de Requisitos para o EBD Madureira. Esta versão já contempla a integração com a Hostinger e a paridade total entre o aplicativo e a versão web.

2. Pilares Tecnológicos
Backend: PHP 8.x utilizando PDO para segurança (SQL Injection).
Banco de Dados: MySQL (Hospedado na Hostinger).
Mobile: React Native com Expo.
Web: React Native for Web (para manter o site idêntico ao app).
Infraestrutura: Hospedagem na Hostinger sob o subdomínio ebd.adparaiso.com.br

Documento de Requisitos Atualizado: EBD Madureira
1. Requisitos Funcionais (RF)
Ações e funcionalidades diretas que o sistema deve executar.
RF01 - Saudação Dinâmica e Identidade Real: O cabeçalho deve exibir uma saudação ("Bom dia", "Boa tarde" ou "Boa noite") baseada no horário local do dispositivo, obrigatoriamente seguida do nome real do utilizador autenticado (ex: "Boa noite, David").
RF02 - Gestão de Acessos: Sistema de autenticação com níveis de permissão para Administradores, Secretários e Professores.
RF03 - Estrutura Hierárquica: Cadastro ilimitado de congregações, setores e campos, permitindo a gestão centralizada.
RF04 - Gestão de Membros: Cadastro completo de alunos e professores, com foco em datas de nascimento para automação de aniversariantes.
RF05 - Chamada Inteligente: Interface de frequência simplificada (um clique) com suporte a chamadas dinâmicas.
RF06 - Módulo de Engajamento: Registo de presença e critérios adicionais (Bíblia, revista e material didático) para composição da pontuação.
RF07 - Comunicação Interna: Envio de avisos administrativos com notificações em tempo real para os professores.
RF08 - Timeline do Aluno: Visualização cronológica individual do histórico de assiduidade.
RF09 - Painel de Indicadores: Dashboards com gráficos de desempenho por turma e congregação.
RF10 - Gamificação e Rankings: Listas automáticas dos alunos com maior pontuação e melhor assiduidade.
RF11 - Inteligência Preventiva: Alertas automáticos para casos de evasão (faltas consecutivas) e lembretes de aniversários.
RF12 - Relatórios Automatizados: Geração de PDF e resumos estatísticos imediatos após o encerramento da aula.
RF13 - Controlo de Tesouraria: Registo e relatório de ofertas e entradas financeiras da EBD.
RF14 - Interface Web Espelhada: Versão web acessível via navegador que deve ser rigorosamente idêntica ao aplicativo móvel quando acedida por telemóvel, facilitando a gestão e impressão via desktop.
RF15 - Gestão de Escala de Ensino: O professor titular/responsável pela turma deve possuir uma interface para montar a escala de aulas do trimestre, vinculando previamente qual professor ministrará a lição de cada data.
RF19 - Painel de Configurações Globais: A interface deve possuir uma área exclusiva para administradores gerenciarem as regras de negócio e a estrutura da escola (Sedes, Filiais e Departamentos).
RF20 - Regras de Exibição na Chamada: O sistema deve possuir um "toggle" (chave liga/desliga) para definir se a lista de chamada exibe o nome completo do aluno ou apenas o Nome Abreviado (primeiro e último nome) para limpar a interface.
RF21 - Controle de Pontos Extras: O administrador deve poder habilitar ou desabilitar se os "pontos extras" dados pelos professores (além de Bíblia e Revista) entrarão no cálculo do ranking geral.
RF22 - Cálculo Dinâmico de Aproveitamento: O sistema deve calcular o aproveitamento da turma considerando a métrica (alunos presentes / alunos matriculados). Deve haver uma configuração para incluir ou não os visitantes nesse cálculo para desempate de rankings.
RF23 - Auditoria e Logs: O painel deve conter um "Registro de atividades" para rastrear ações importantes (quem deletou um aluno, quem alterou uma configuração) e uma lixeira para "Cadastros inativos" (soft delete).

RF16 - Professores Convidados (Visitantes): A montagem da escala deve permitir a atribuição da aula a um professor já cadastrado no banco de dados ou permitir a digitação livre do nome de um professor visitante/convidado (que não possui login no sistema).
RF17 - Vínculo Automático na Chamada: Ao abrir a chamada do dia, o sistema deve puxar automaticamente o nome do professor escalado para aquela data como o ministrante oficial do relatório.
RF18 - Múltiplos Papéis Dinâmicos: O sistema deve permitir que um mesmo usuário transite entre diferentes papéis simultaneamente, podendo estar matriculado como "Aluno" em uma turma (ex: Jovens) e vinculado como "Professor" em outra (ex: Adolescentes).
RF27 - Painel de Chamada por Classe: Interface dedicada para cada turma onde o professor visualiza a lista de alunos e marca a presença com um toque.
RF28 - Contadores de Itens Pedagógicos: Seletores numéricos (incremento/decremento) para contabilizar o total de Bíblias, Revistas e Visitantes presentes na aula.
RF29 - Registro de Oferta por Turma: Campo específico para inserção do valor financeiro arrecadado na classe (integrado ao módulo de tesouraria).
RF30 - Campo de Observações/Anotações: Área de texto livre para o professor relatar ocorrências ou notas sobre a aula.
RF31 - Status de Conclusão (Ícones de Alerta): A listagem geral de classes deve exibir visualmente quais turmas já enviaram o relatório (check verde) e quais ainda estão pendentes (ícone de exclamação).
RF32 - Ranking de Vencedores por Departamento: O Dashboard deve exibir automaticamente a "Turma Vencedora" dentro de cada grupo (Infantil, Adolescentes e Adultos) assim que todos os relatórios do dia forem enviados.
RF33 - Cálculo de Aproveitamento Percentual: A classificação deve ser baseada primeiramente na porcentagem de presença real em relação à quantidade de alunos matriculados na turma.
RF34 - Pesos de Pontuação para Desempate: Em caso de empate na porcentagem de presença, o sistema deve aplicar os seguintes critérios sucessivos:
Quantidade de Bíblias: Maior proporção por aluno.
Visitantes: Contagem de visitantes (critério de alto impacto no crescimento).
Oferta (Critério de Desempate Final): Se persistir o empate, a turma com maior valor de oferta financeira é declarada vencedora.




2. Requisitos Não Funcionais (RNF)
Critérios técnicos, de performance e de infraestrutura.
RNF01 - Desenvolvimento Nativo e Web: Aplicação construída em React Native (Expo) para geração de APK, com versão web responsiva utilizando a mesma lógica de componentes.
RNF02 - Backend Centralizado: API desenvolvida em PHP (PDO) hospedada na Hostinger para servir tanto o App quanto o Site.
RNF03 - Base de Dados Unificada: Utilização de base de dados MySQL na Hostinger, garantindo integridade e sincronização imediata entre dispositivos.
RNF04 - Deploy e Endereçamento: O sistema deve ser acessível via subdomínio ou subdiretório profissional (ex: ebd.adparaiso.com.br).
RNF05 - Performance de Interface: O lançamento de chamadas deve ser optimizado para conclusão em poucos segundos, superando a agilidade do papel.
RNF06 - Segurança de Dados: Comunicação via HTTPS com certificado SSL activo na Hostinger para proteção das informações financeiras e de membros.
RNF07 - Escalabilidade: Arquitetura do banco preparada para crescimento no volume de alunos e congregações sem perda de desempenho.


3. Regras de Negócio e Interface (RN)
Lógicas e restrições de sistema.
RN01 - Layout Contínuo: É proibida a utilização de divisões visuais por "1º trimestre" ou "2º trimestre" na interface de desenvolvimento. O progresso deve ser apresentado de forma fluida.
RN02 - Unificação de Lógica: A mesma API PHP deve processar as requisições do APK e da Versão Web para garantir que não existam divergências de dados.
RN03 - Cálculo de Ranking: A pontuação é acumulada estritamente pela soma de presença e materiais levados dentro do período de consulta selecionado.
RN04 - Níveis de Visibilidade:
Professores: Apenas dados das suas turmas.
Administradores Locais: Dados de toda a sua congregação.
Administradores de Campo: Acesso a todas as filiais e relatórios consolidados.
RN05 - Validação de Relatório: O resumo financeiro e de frequência da filial só é fechado quando todas as turmas enviarem as suas respetivas chamadas.
RN06 - Exibição de Vencedores: O Dashboard deve destacar as turmas vencedoras com um ícone visual (troféu ou medalha) e permitir que os resultados sejam visualizados individualmente por departamento.
RN07 - Gatilho de Finalização: O ranking de vencedores só deve ser "fechado" e exibido quando o status de todas as turmas da congregação estiver como "Enviado".


RN04 - Níveis de Visibilidade (ATUALIZADA):
Professores: Podem visualizar a escala de ensino, os temas das lições e o cronograma de todas as turmas da congregação. No entanto, só podem editar/lançar chamadas nas turmas em que são oficialmente responsáveis ou escalados.
Administradores Locais: Controle total sobre os dados de toda a congregação.
Administradores de Campo: Acesso total a todas as filiais e relatórios consolidados.
RN06 - Presença do Professor/Aluno: Se um usuário com papel duplo (Professor em uma classe e Aluno em outra) estiver escalado para lecionar no mesmo horário em que seria aluno, a sua presença na classe de origem deve ser tratada (ex: justificada ou registrada por participação na obra) conforme o critério adotado pela gestão.


Esta estrutura está pronta para ser utilizada como contexto no Cursor AI, permitindo que a ferramenta gere os ficheiros dentro da arquitetura de pastas definida (/backend, /mobile, /web). Qual módulo deseja detalhar agora para a equipa técnica?



3. Regras de Negócio e Interface (RN)
Lógicas restritivas e direcionamentos de layout que a programação deve obedecer.
RN01 - Restrição de Interface (Semestres/Trimestres): A interface principal de desenvolvimento e acompanhamento do aluno não deve exibir quebras ou separações visuais por "1º trimestre", "2º trimestre", etc. A visualização do progresso deve ser fluida ou consolidada em um formato de linha do tempo contínua.
RN02 - Cálculo de Desempenho: A pontuação do aluno no ranking é o somatório estrito dos critérios definidos (presença + materiais) dentro do período avaliado.
RN03 - Visibilidade Hierárquica:
Professores visualizam e editam apenas os dados e chamadas das suas respectivas turmas.
Administradores de Congregação/Filial visualizam todas as turmas de sua igreja local.
Administradores Gerais/Campo visualizam os relatórios consolidados de todas as filiais cadastradas.
RN04 - Trava de Fechamento de Relatório: O relatório estatístico de um dia de aula de uma filial só computa 100% de conclusão após o envio da chamada por todos os professores logados naquele dia.
Boa noite! Excelente iniciativa. Ter essa documentação formatada como um "Guia Mestre" (Master Prompt) é exatamente o que o Cursor AI precisa para gerar o código com precisão e evitar retrabalho.
Como você já tem os Requisitos Funcionais e Não Funcionais (itens 1 a 3), vou organizar esses novos dados como a continuação direta do seu documento. Formatei de um jeito técnico e escaneável, ideal para você copiar e colar no seu arquivo README.md ou instrucoes_cursor.txt dentro da sua nova pasta /docs.
Aqui está a organização padronizada:

4. Arquitetura do Workspace (Estrutura de Pastas)
O repositório deve seguir uma separação clara entre front-end e back-end para facilitar a manutenção e o desenvolvimento via Cursor AI. O projeto raiz será nomeado ebd-madureira.
/backend: Destinado aos scripts PHP (PDO) e à lógica da API RESTful que fará a comunicação com o banco de dados MySQL na Hostinger.
/mobile: Contém o projeto React Native, gerenciado via Expo, responsável pela geração do APK.
/web: Destinado ao site responsivo, atuando como um espelho da aplicação mobile.
/docs: Central de documentação do projeto, contendo o levantamento de requisitos, dicionário de dados e instruções de prompt para a IA.
5. Modelagem do Banco de Dados (Relacional)
O sistema utiliza um banco de dados MySQL hospedado na Hostinger. A estrutura foi desenhada para suportar a hierarquia do EBD Madureira.
Tabela
Campos Principais
Descrição
congregações
id, nome, setor, cidade, status
Cadastro das filiais e sede.
usuarios
id, congregação_id, nome_real, email, senha, nivel_acesso
Controle de acesso (admin, secretário, professor).
turmas
id, congregação_id, nome_turma
Divisão das classes (ex: Jovens, Adultos).
alunos
id, congregação_id, turma_id, nome, data_nascimento, telefone_responsavel
Registro completo dos alunos matriculados.
chamadas
id, turma_id, professor_id, data_aula, tema_licao
Cabeçalho do registro de cada aula ministrada.
frequencia
id, chamada_id, aluno_id, presenca (bool), biblia (bool), revista (bool), pontuacao_total
Linhas de detalhe da chamada para cálculo de ranking.
financeiro
id, congregação_id, data, valor, tipo (oferta/doação), descricao
Lançamentos de caixa da escola bíblica.
usuarios (Pessoas) 
id, congregação_idIdentificadores padrão do sistema.nomeVARCHAR - Obrigatório.sexoENUM ('M', 'F') - Obrigatório.data_nascimentoDATE - Opcional.telefone, emailVARCHAR - Opcional. (O e-mail será obrigatório apenas se a pessoa for ter login no app).senhaVARCHAR - Opcional. (Gerada apenas para quem for acessar o app).escolaridade, estado_civilVARCHAR - Opcional (Dados extras).logradouro, numero, bairro, cidade, estadoVARCHAR - Opcional (Endereço completo).responsavel_1_nome, responsavel_1_telVARCHAR - Opcional (Foco em alunos infantis/adolescentes).responsavel_2_nome, responsavel_2_telVARCHAR - Opcional.data_matriculaDATE - Preenchimento automático com a data do dia do cadastro.is_adminBOOLEAN - Padrão false. 



6. Diretrizes de Interface (UI/UX) e Componentização
O design system deve garantir que o aplicativo e a versão web sejam visualmente limpos, profissionais e idênticos na experiência de uso.
Paleta de Cores: Predominância de tons de azul escuro e branco (inspirado em plataformas corporativas de gestão), utilizando verde ou azul vibrante exclusivamente para botões de ação principal (Call to Action).
Componentes Universais: O desenvolvimento no Cursor deve priorizar componentes no React Native que sejam compatíveis com a web, garantindo o reaproveitamento de código entre os diretórios /mobile e /web.
Layout Contínuo: A interface não deve utilizar quebras ou blocos separando o acompanhamento por períodos isolados (como "1º trimestre", "2º trimestre"). A visualização do desenvolvimento e dos relatórios deve ser limpa e contínua.
Header Dinâmico e Personalizado: O topo do aplicativo deve utilizar a biblioteca date-fns (ou equivalente nativo) para renderizar uma saudação ancorada no horário local do dispositivo, puxando estritamente o nome real do usuário autenticado no banco de dados, sem o uso de nomes fictícios ou genéricos de espaço reservado.
Regra de Horário: 05:00 às 11:59 $\rightarrow$ "Bom dia, [Nome do Usuário]"
Regra de Horário: 12:00 às 17:59 $\rightarrow$ "Boa tarde, [Nome do Usuário]"
Regra de Horário: 18:00 às 04:59 $\rightarrow$ "Boa noite, [Nome do Usuário]
Guia Mestre de Identidade Visual: EBD Madureira
1. Paleta de Cores Oficial (Inspirada no Papel Timbrado)
Esta paleta deve ser a base para todos os componentes do React Native (App/Web) e para a estilização dos relatórios gerados em PDF no back-end PHP.
Categoria de Uso
Cor (Exemplo de Código)
Aplicação Prática
Cor Primária (Oficial)
primary: '#0078D4'
Azul Royal do Cabeçalho. Usar em: Barras de navegação (Header), Títulos principais, Botões de ação principal (Salvar, Cadastrar) e ícones ativos.
Fundo (Background)
background: '#FFFFFF'
Branco Puro. Cor base de fundo de todas as telas para garantir clareza e leitura.
Fundo Secundário (Cards)
card: '#F3F4F6'
Cinza Claríssimo. Usar para destacar cards de turmas, linhas alternadas em tabelas e campos de input que estão desabilitados.
Texto Principal
text: '#1F2937'
Preto Suave (Grafite). Usar em parágrafos, nomes de alunos e descrições de relatórios.
Destaque/Informação
accent: '#3B82F6'
Azul Claro. Usar em links, status de "Em andamento" e bordas de foco em formulários.
Sucesso/Aprovado
success: '#10B981'
Verde. Usar para ícones de "Relatório Enviado" e pontuações positivas no ranking.

2. Diretrizes de UI/UX (Ajustadas para a Nova Paleta)
Contraste e Leitura: Como o azul primário (#0078D4) é forte, os textos dentro das barras de navegação ou botões azuis devem ser obrigatoriamente brancos (#FFFFFF) para garantir a acessibilidade.
Componentes Limpos: O Cursor deve focar em uma interface moderna e minimalista (sem sombras exageradas ou gradientes complexos), imitando a clareza do design system da Hostinger e do papel timbrado.
Saudação Real (Com a Nova Cor): O componente de saudação ("Bom dia, David") deve ser renderizado no cabeçalho em texto branco sobre o fundo Azul Royal.

