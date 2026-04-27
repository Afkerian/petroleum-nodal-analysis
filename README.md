# 🛢️ VIOLET: Petroleum Production System

**VIOLET** es una herramienta de software desarrollada en Python para realizar **Análisis Nodal** en pozos petroleros. La aplicación permite calcular y graficar curvas de comportamiento de afluencia (IPR) y curvas de demanda de flujo vertical (VLP), utilizando correlaciones estándar de la industria.

![Estado del Proyecto](https://img.shields.io/badge/Estado-Terminado-green)
![Python](https://img.shields.io/badge/Python-3.8%2B-blue)
![Licencia](https://img.shields.io/badge/Licencia-MIT-lightgrey)

## 📋 Características Principales

### 1. Modelado de Curvas IPR (Inflow Performance Relationship)
Generación de curvas de oferta del yacimiento utilizando los siguientes modelos:
* **Vogel:** Para yacimientos saturados.
* **Fetkovich:** Modelo exponencial para flujo turbulento.
* **Wiggins:** Modelo trifásico (agua/petróleo).
* **Darcy:** Flujo semi-estacionario utilizando parámetros petrofísicos ($k, h, \mu, B_o$, etc.).

### 2. Modelado de Curvas VLP (Vertical Lift Performance)
Cálculo del gradiente de presión en la tubería de producción (Tubing) mediante un algoritmo iterativo de **31 Pasos** (Metodología Estricta). Incluye:
* Cálculo de propiedades PVT (Presión de burbuja, $R_s, B_o, Z, \mu_g$, etc.).
* Correlaciones integradas: **Standing**, **Beggs & Robinson**, **Dranchuk-Abou-Kassem**, **Lee et al.**
* Detección automática de convergencia ($Delta H \approx Longitud$).

### 3. Interfaz Gráfica (GUI)
* Diseño moderno con tema personalizado "Violet".
* Gráficas interactivas integradas con **Matplotlib**.
* Tablas de resultados detallados paso a paso para validación de cálculos.

---

## 🛠️ Requisitos del Sistema

Para ejecutar este proyecto necesitas tener instalado:
* **Python 3.8** o superior.
* Las siguientes librerías de Python:
    * `numpy`
    * `matplotlib`
    * `tkinter` (Generalmente incluido con Python, pero en Linux requiere instalación: `sudo apt-get install python3-tk`).

---

## 📂 Estructura del Proyecto

⚠️ **Importante:** Para que el código funcione, los archivos deben estar organizados en las siguientes carpetas. Si colocas todos los archivos en una sola carpeta, los `imports` fallarán.

```text
VIOLET-PROJECT/
│
├── main.py                 # Archivo principal de ejecución
├── README.md               # Este archivo
├── requirements.txt        # Dependencias (opcional)
│
├── logic/                  # Lógica de cálculo y modelos matemáticos
│   ├── ipr_models.py
│   ├── vlp_models.py
│   └── pvt_correlations.py
│
└── ui/                     # Interfaz Gráfica y Estilos
    ├── main_window.py
    ├── tab_ipr.py
    ├── tab_vlp.py
    ├── graph_widget.py
    └── styles.py
````

-----

## 🚀 Instalación y Ejecución

Sigue estos pasos para replicar el entorno en tu computadora:

### 1\. Clonar o Descargar

Descarga los archivos y organízalos según la estructura mostrada arriba.

### 2\. Crear un entorno virtual (Recomendado)

Abre tu terminal en la carpeta del proyecto:

```bash
python -m venv venv
# En Windows:
venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate
```

### 3\. Instalar dependencias

Si no tienes un archivo `requirements.txt`, instala manualmente las librerías necesarias:

```bash
pip install numpy matplotlib
```

### 4\. Ejecutar la aplicación

Desde la carpeta raíz del proyecto, ejecuta:

```bash
python main.py
```

-----

## 📖 Guía de Uso Rápida

### Pestaña IPR (Curvas de Afluencia)

1.  Selecciona el modelo deseado en el menú desplegable (ej. Vogel).
2.  Ingresa los datos requeridos (Presión de yacimiento, Qmax, etc.).
3.  Haz clic en **"Calcular Curva IPR"**.
4.  Observa la gráfica y la tabla de valores Pwf vs Caudal.

### Pestaña VLP & Análisis Nodal

1.  Ingresa los datos de **Geometría del Pozo** (Profundidad, Diámetro del Tubing).
2.  Ingresa los **Datos de Producción** (Presión de cabeza, API, GOR, BSW, etc.).
3.  Define los datos de intersección IPR (Presión yacimiento y Qmax).
4.  Haz clic en **"Calcular Análisis Nodal"**.
5.  El sistema iterará y mostrará:
      * La curva VLP superpuesta a la IPR.
      * Una tabla detallada con las 31 variables calculadas para el último punto de convergencia.

-----

## 📄 Descripción de Archivos

  * **`main.py`**: Punto de entrada. Inicializa la ventana principal.
  * **`ui/styles.py`**: Define la paleta de colores y estilos visuales (Tema Violeta).
  * **`ui/graph_widget.py`**: Clase reutilizable para incrustar gráficas de Matplotlib en Tkinter.
  * **`logic/pvt_correlations.py`**: Biblioteca estática con fórmulas para $P_b, R_s, B_o, \mu_o, Z$, etc.
  * **`logic/vlp_models.py`**: Contiene el algoritmo iterativo principal para calcular la presión de fondo fluyente ($P_{wf}$) basado en la longitud de la tubería.

-----

## 👤 Autor

Desarrollado como parte de un proyecto de ingeniería de reservorios y producción.

