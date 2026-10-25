import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View, type TextInputInstance } from 'react-native';

import { api } from '@/api/cliente';
import { ErrorApi, esConflicto } from '@/api/errores';
import { Boton, BotonTexto, CampoTexto, Logo, Pantalla, Texto } from '@/componentes';
import { useSesion } from '@/sesion';
import { espacio } from '@/tema';
import { errorEmail, errorNombre, errorPasswordNueva, LARGO_MINIMO_PASSWORD } from '@/validaciones';

export default function Registro() {
  const router = useRouter();
  const { entrar } = useSesion();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Los avisos aparecen después del primer intento y se van actualizando mientras escribe.
  const [intento, setIntento] = useState(false);
  // El 409 "Ya hay una cuenta con ese email": va debajo del email y se borra al cambiarlo.
  const [emailUsado, setEmailUsado] = useState<string | null>(null);
  const campoEmail = useRef<TextInputInstance>(null);
  const campoPassword = useRef<TextInputInstance>(null);

  const errores = {
    nombre: intento ? errorNombre(nombre) : null,
    email: (intento ? errorEmail(email) : null) ?? emailUsado,
    password: intento ? errorPasswordNueva(password) : null,
  };

  const registro = useMutation({
    mutationFn: () => api.registro({ nombre: nombre.trim(), email: email.trim(), password }),
    // Una cuenta nueva todavía no sigue a nadie: la navegación lleva a la bienvenida.
    onSuccess: (tokens) => entrar(tokens),
    onError: (error) => {
      if (esConflicto(error)) setEmailUsado(`${error.message}. Probá entrar con tu contraseña.`);
      else if (error instanceof ErrorApi && error.estado < 500) Alert.alert('No pudimos crear la cuenta', error.message);
      else Alert.alert('No pudimos crear la cuenta', 'Revisá que el teléfono tenga internet y probá de nuevo.');
    },
  });

  const enviar = () => {
    setIntento(true);
    if (errorNombre(nombre) || errorEmail(email) || errorPasswordNueva(password) || emailUsado) return;
    registro.mutate();
  };

  const yaTengoCuenta = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  return (
    <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
      <View style={estilos.columna}>
        <Logo />
        <View style={estilos.titulo}>
          <Texto variante="titulo" accessibilityRole="header">
            Creá tu cuenta
          </Texto>
          <Texto color="textoSecundario">Con tu cuenta vas a ver cómo está, mandarle mensajes y recibir avisos.</Texto>
        </View>

        <View style={estilos.campos}>
          <CampoTexto
            etiqueta="Tu nombre"
            value={nombre}
            onChangeText={setNombre}
            error={errores.nombre}
            placeholder="Como te dice la familia"
            autoCapitalize="words"
            textContentType="givenName"
            autoComplete="given-name"
            maxLength={80}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => campoEmail.current?.focus()}
          />
          <CampoTexto
            ref={campoEmail}
            etiqueta="Email"
            value={email}
            onChangeText={(valor) => {
              setEmail(valor);
              setEmailUsado(null);
            }}
            error={errores.email}
            placeholder="nombre@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            // Con "username" iOS guarda el email junto con la contraseña nueva en el llavero.
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => campoPassword.current?.focus()}
          />
          <CampoTexto
            ref={campoPassword}
            etiqueta="Contraseña"
            value={password}
            onChangeText={setPassword}
            error={errores.password}
            placeholder={`Al menos ${LARGO_MINIMO_PASSWORD} caracteres`}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            autoComplete="new-password"
            passwordRules={`minlength: ${LARGO_MINIMO_PASSWORD};`}
            returnKeyType="go"
            onSubmitEditing={enviar}
          />
        </View>

        <Boton titulo="Crear cuenta" onPress={enviar} cargando={registro.isPending} />

        <View style={estilos.pie}>
          <Texto color="textoSecundario">¿Ya tenés cuenta?</Texto>
          <BotonTexto titulo="Entrar" onPress={yaTengoCuenta} />
        </View>
      </View>
    </Pantalla>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: espacio[6], paddingTop: espacio[4] },
  titulo: { gap: espacio[2] },
  campos: { gap: espacio[5] },
  pie: { alignItems: 'center' },
});
