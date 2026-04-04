# Nexus - Credenciais de Teste

## Como Usar

1. **Na tela de login, clique em "Criar usuários de teste"** para popular o banco de dados
2. Use as credenciais abaixo para fazer login

## Usuários de Teste

### João Silva
- **Nome Completo:** João Silva
- **CPF (senha):** 12345678900
- **Email gerado:** joao.silva@nexus.local (sem acento)

### Maria Santos
- **Nome Completo:** Maria Santos
- **CPF (senha):** 98765432100
- **Email gerado:** maria.santos@nexus.local

## Como Funciona o Login

O sistema usa apenas **2 campos**:
1. **Nome Completo** (ex: João Silva)
2. **CPF** como senha (ex: 12345678900)

O sistema automaticamente:
- Remove acentos dos nomes
- Converte para minúsculas
- Gera email: `joao.silva@nexus.local` (acentos removidos automaticamente)
- Usa o CPF como senha

**Exemplo:**
- `João Silva` + `12345678900` → Email: `joao.silva@nexus.local` / Senha: `12345678900`

---

**Desenvolvido por Dodoco em parceria com Nexus**