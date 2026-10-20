import { useRouter } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';

import { BotonIcono } from './BotonIcono';

type Props = {
  // En los modales es una cruz ("Cerrar") en vez de la flecha.
  cerrar?: boolean;
};

export function BotonVolver({ cerrar }: Props) {
  const router = useRouter();

  // Si se entró directo (ej. desde una notificación) no hay a dónde volver: vamos a Inicio.
  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return <BotonIcono icono={cerrar ? X : ChevronLeft} etiqueta={cerrar ? 'Cerrar' : 'Volver'} onPress={volver} />;
}
