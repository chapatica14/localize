"""Cria uma conta da Secretaria. Uso: python criar_admin.py"""
from getpass import getpass
from app import q, generate_password_hash

nome = input("Nome: ").strip()
email = input("Email: ").strip().lower()
senha = getpass("Senha: ")
q("INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,'secretaria')",
  (nome, email, generate_password_hash(senha)), write=True)
print("Conta da Secretaria criada.")
