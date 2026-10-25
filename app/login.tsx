import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View, type TextInputInstance } from 'react-native';

import { api } from '@/api/cliente';
import { ErrorApi } from '@/api/errores';
import { Boton, BotonTexto, CampoTexto, Logo, Pantalla, Texto } from '@/componentes';
import { useSesion } from '@/sesion';
import { espacio } from '@/tema';
import { errorEmail, errorPasswordLogin } from '@/validaciones';

export default function Login() {
  const router = useRouter();
  const { entrar } = useSesion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Los avisos aparecen después del primer intento y se van actualizando mientras escribe.
  const [intento, setIntento] = useState(false);
  // Lo que respondió el servidor (ej. 401 "Email o contraseña incorrectos"); se borra al cambiar algo.
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const campoPassword = useRef<TextInputInstance>(null);

  const errores = {
    email: intento ? errorEmail(email) : null,
    password: intento ? errorPasswordLogin(password) : null,
  };

  const login = useMutation({
    mutationFn: () => api.login(email.trim(), password),
    onSuccess: (tokens) => entrar(tokens),
    onError: (error) => {
      // 401, 403 o 429: el servidor ya explica qué pasó.
      if (error instanceof ErrorApi && error.estado < 500) setErrorServidor(error.message);
      else Alert.alert('No pudimos entrar', 'Revisá que el teléfono tenga internet y probá de nuevo.');
    },
  });

  const enviar = () => {
    setIntento(true);
    if (errorEmail(email) || errorPasswordLogin(password)) return;
    login.mutate();
  };

  const cambiar = (setter: (valor: string) => void) => (valor: string) => {
    setter(valor);
    setErrorServidor(null);
  };

  return (
    <Pantalla bordes={['top', 'bottom', 'left', 'right']}>
      <View style={estilos.columna}>
        <Logo />
        <View style={estilos.titulo}>
          <Texto variante="titulo" accessibilityRole="header">
            Entrá a Eloy
          </Texto>
          <Texto color="textoSecundario">Para estar cerca de los tuyos, estés donde estés.</Texto>
        </View>

        <View style={estilos.campos}>
          <CampoTexto
            etiqueta="Email"
            value={email}
            onChangeText={cambiar(setEmail)}
            error={errores.email}
            placeholder="nombre@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            // iOS ofrece la cuenta guardada en el llavero.
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
            onChangeText={cambiar(setPassword)}
            error={errores.password ?? errorServidor}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={enviar}
          />
        </View>

        <Boton titulo="Entrar" onPress={enviar} cargando={login.isPending} />

        <View style={estilos.pie}>
          <Texto color="textoSecundario">¿Es la primera vez?</Texto>
          <BotonTexto titulo="Crear cuenta" onPress={() => router.push('/registro')} />
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
